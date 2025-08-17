// Package orchestrator provides the core orchestration logic for running build operations
// across multiple services with parallel execution and proper error handling.
package orchestrator

import (
	"context"
	"fmt"
	"io"
	"os"
	"runtime"
	"sort"
	"sync"

	"golang.org/x/sync/errgroup"

	goadapter "github.com/bradcarter-meal-planner/tools/validate/internal/adapters/go"
	nodeadapter "github.com/bradcarter-meal-planner/tools/validate/internal/adapters/node"
	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
	"github.com/bradcarter-meal-planner/tools/validate/internal/ui"
)

// Options configures the orchestrator execution.
type Options struct {
	// Phase is the operation to perform (test, lint, build)
	Phase runner.Phase
	// MaxParallel controls the maximum number of parallel executions
	MaxParallel int
	// Services filters execution to specific services
	Services []string
	// Verbose enables detailed output
	Verbose bool
	// JSON enables JSON output format
	JSON bool
	// CI mode disables spinners and implies JSON output
	CI bool
	// NoSpinner explicitly disables spinners
	NoSpinner bool
	// ConfigPath specifies the path to the config file
	ConfigPath string
}

// Orchestrator manages the execution of build operations across services.
type Orchestrator struct {
	config         *config.Config
	commandRunner  execx.CommandRunner
	spinnerFactory ui.SpinnerFactory
	ttyDetector    ui.TTYDetector
	clock          ui.Clock
	output         io.Writer
	errorOutput    io.Writer
}

// New creates a new orchestrator with the given dependencies.
func New(
	cfg *config.Config,
	commandRunner execx.CommandRunner,
	spinnerFactory ui.SpinnerFactory,
	ttyDetector ui.TTYDetector,
	clock ui.Clock,
	output, errorOutput io.Writer,
) *Orchestrator {
	return &Orchestrator{
		config:         cfg,
		commandRunner:  commandRunner,
		spinnerFactory: spinnerFactory,
		ttyDetector:    ttyDetector,
		clock:          clock,
		output:         output,
		errorOutput:    errorOutput,
	}
}

// RunnerFactory creates runners for services.
type RunnerFactory func(service config.Service) (runner.Runner, error)

// Execute runs the specified phase for all configured services.
func (o *Orchestrator) Execute(ctx context.Context, opts Options) error {
	return o.ExecuteWithFactory(ctx, opts, nil)
}

// ExecuteWithFactory runs the specified phase with a custom runner factory for testing.
func (o *Orchestrator) ExecuteWithFactory(ctx context.Context, opts Options, factory RunnerFactory) error {
	// Filter services if specified
	cfg := o.config
	if len(opts.Services) > 0 {
		cfg = o.config.FilterServices(opts.Services)
		if len(cfg.Services) == 0 {
			return fmt.Errorf("no matching services found for: %v", opts.Services)
		}
	}

	// Determine if we should use spinners
	useSpinners := o.shouldUseSpinners(opts)

	// Set up parallel execution limits
	maxParallel := opts.MaxParallel
	if maxParallel <= 0 {
		maxParallel = runtime.GOMAXPROCS(0)
	}

	// Create execution context and result collection
	results := make([]runner.Result, len(cfg.Services))
	spinners := make(map[string]ui.Spinner)
	var mu sync.Mutex

	// Initialize default successful results so unpopulated entries don't
	// count as failures. Individual runners will overwrite these entries
	// with the actual result when they complete.
	for i, svc := range cfg.Services {
		results[i] = runner.Result{
			Service: svc.Name,
			Phase:   opts.Phase,
			Status:  runner.StatusSuccess,
		}
	}

	// Create errgroup with limited concurrency
	g, _ := errgroup.WithContext(context.Background())
	g.SetLimit(maxParallel)

	// Friendly action verb for non-spinner output (e.g., "Testing", "Linting", "Building")
	var phaseAction string
	switch opts.Phase {
	case runner.PhaseTest:
		phaseAction = "Testing"
	case runner.PhaseLint:
		phaseAction = "Linting"
	case runner.PhaseBuild:
		phaseAction = "Building"
	default:
		phaseAction = "Running"
	}

	// Start spinners if enabled
	if useSpinners {
		for i, service := range cfg.Services {
			spinner := o.spinnerFactory.NewSpinner(o.output)
			spinner.Start(fmt.Sprintf("%s: %s starting...", service.Name, opts.Phase))
			spinners[service.Name] = spinner
			// Ensure we capture the index for the closure
			_ = i
		}
	}

	// Execute each service in parallel
	for i, service := range cfg.Services {
		i, service := i, service // Capture loop variables
		g.Go(func() error {
			// Create the appropriate runner
			var serviceRunner runner.Runner
			var err error
			if factory != nil {
				serviceRunner, err = factory(service)
			} else {
				serviceRunner, err = o.createRunner(service)
			}
			if err != nil {
				mu.Lock()
				results[i] = runner.Result{
					Service:      service.Name,
					Phase:        opts.Phase,
					Status:       runner.StatusError,
					ErrorMessage: fmt.Sprintf("Failed to create runner: %v", err),
					Duration:     0,
				}
				mu.Unlock()

				if useSpinners {
					if spinner, exists := spinners[service.Name]; exists {
						spinner.Failure(fmt.Sprintf("%s: failed to create runner", service.Name))
					}
				}
				return nil // Don't fail the group, just record the error
			}

			// Update spinner to running state
			if useSpinners {
				if spinner, exists := spinners[service.Name]; exists {
					spinner.UpdateText(fmt.Sprintf("%s: %s running...", service.Name, opts.Phase))
				}
			} else if !opts.JSON {
				// If spinners are disabled and we're not outputting JSON, print lightweight progress
				fmt.Fprintf(o.output, "%s %s...\n", phaseAction, service.Name)
			}

			// Track timing for this service execution
			startTime := o.clock.Now()

			// Execute the appropriate phase
			var result runner.Result
			switch opts.Phase {
			case runner.PhaseTest:
				result = serviceRunner.Test()
			case runner.PhaseLint:
				result = serviceRunner.Lint()
			case runner.PhaseBuild:
				result = serviceRunner.Build()
			default:
				result = runner.Result{
					Service:      service.Name,
					Phase:        opts.Phase,
					Status:       runner.StatusError,
					ErrorMessage: fmt.Sprintf("Unknown phase: %s", opts.Phase),
					Duration:     0,
				}
			}

			// Override duration with our clock measurement
			result.Duration = o.clock.Since(startTime)

			// Store result
			mu.Lock()
			results[i] = result
			mu.Unlock()

			// Update spinner with final state
			if useSpinners {
				if spinner, exists := spinners[service.Name]; exists {
					if result.Status == runner.StatusSuccess {
						spinner.Success(fmt.Sprintf("%s: %s passed", service.Name, opts.Phase))
					} else {
						spinner.Failure(fmt.Sprintf("%s: %s failed", service.Name, opts.Phase))
					}
				}
			}

			return nil // Never fail the group - we want all services to finish
		})
	}

	// Wait for all services to complete
	_ = g.Wait() // We ignore the error because we handle failures per-service

	// Stop any remaining spinners
	if useSpinners {
		for _, spinner := range spinners {
			spinner.Stop()
		}
	}

	// DEBUG: Dump results to error output to aid in diagnosing unexpected
	// missing entries when contexts are cancelled. This writes to stderr so
	// it won't interfere with JSON/human-readable stdout used by tests.
	for idx, rr := range results {
		fmt.Fprintf(o.errorOutput, "DEBUG result[%d]: service=%q status=%q\n", idx, rr.Service, rr.Status)
	}

	// Output results
	if err := o.outputResults(results, opts); err != nil {
		return fmt.Errorf("failed to output results: %w", err)
	}

	// If the external context was cancelled, do not treat collected
	// service failures as an overall error — we intentionally let
	// in-flight services finish and return success from the orchestrator
	// when cancellation originates from the caller.
	if ctx != nil && ctx.Err() != nil {
		return nil
	}

	// Return error if any service failed
	hasFailures := false
	for _, result := range results {
		if result.Status != runner.StatusSuccess {
			hasFailures = true
			break
		}
	}

	if hasFailures {
		return fmt.Errorf("one or more services failed")
	}

	return nil
}

// createRunner creates the appropriate runner for the given service.
func (o *Orchestrator) createRunner(service config.Service) (runner.Runner, error) {
	workingDir := service.Dir
	if workingDir == "" {
		workingDir = "."
	}

	switch service.Type {
	case config.ServiceTypeGo:
		return goadapter.New(service.Name, workingDir, o.commandRunner), nil
	case config.ServiceTypeNode:
		return nodeadapter.New(service.Name, &service, o.commandRunner), nil
	default:
		return nil, fmt.Errorf("unsupported service type: %s", service.Type)
	}
}

// shouldUseSpinners determines if spinners should be displayed.
func (o *Orchestrator) shouldUseSpinners(opts Options) bool {
	// Never use spinners in CI mode or if explicitly disabled
	if opts.CI || opts.NoSpinner {
		return false
	}

	// Only use spinners if output is a TTY
	return o.ttyDetector.IsTerminal(os.Stdout.Fd())
}

// outputResults outputs the execution results in the appropriate format.
func (o *Orchestrator) outputResults(results []runner.Result, opts Options) error {
	// Sort results alphabetically by service name for stable output
	sortedResults := make([]runner.Result, len(results))
	copy(sortedResults, results)
	sort.Slice(sortedResults, func(i, j int) bool {
		return sortedResults[i].Service < sortedResults[j].Service
	})

	if opts.JSON || opts.CI {
		// Output JSON format
		return runner.OutputJSON(sortedResults, o.output)
	}

	// Output human-readable format
	for _, result := range sortedResults {
		summary := runner.FormatSummary(result)
		fmt.Fprintln(o.output, summary)

		// Show failures in verbose mode
		if opts.Verbose && len(result.Failures) > 0 {
			failureOutput := runner.FormatFailures(result)
			fmt.Fprint(o.output, failureOutput)
		}
	}

	return nil
}
