package orchestrator

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"sort"
	"sync"
	"syscall"

	goadapter "github.com/bradcarter-meal-planner/tools/validate/internal/adapters/go"
	nodeadapter "github.com/bradcarter-meal-planner/tools/validate/internal/adapters/node"
	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
	"github.com/bradcarter-meal-planner/tools/validate/internal/ui"
	"github.com/bradcarter-meal-planner/tools/validate/internal/watcher"
)

// WatchOptions configures the watch orchestrator execution.
type WatchOptions struct {
	// Extensions filters which file types to watch
	Extensions []string
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

// WatchOrchestrator manages file watching and lint execution.
type WatchOrchestrator struct {
	config         *config.Config
	commandRunner  execx.CommandRunner
	spinnerFactory ui.SpinnerFactory
	ttyDetector    ui.TTYDetector
	clock          ui.Clock
	output         io.Writer
	errorOutput    io.Writer
	watcher        *watcher.Watcher
}

// NewWatchOrchestrator creates a new watch orchestrator.
func NewWatchOrchestrator(
	cfg *config.Config,
	commandRunner execx.CommandRunner,
	spinnerFactory ui.SpinnerFactory,
	ttyDetector ui.TTYDetector,
	clock ui.Clock,
	output, errorOutput io.Writer,
) *WatchOrchestrator {
	return &WatchOrchestrator{
		config:         cfg,
		commandRunner:  commandRunner,
		spinnerFactory: spinnerFactory,
		ttyDetector:    ttyDetector,
		clock:          clock,
		output:         output,
		errorOutput:    errorOutput,
	}
}

// Watch starts file watching and linting on file changes.
func (wo *WatchOrchestrator) Watch(ctx context.Context, opts WatchOptions) error {
	// Filter services if specified
	cfg := wo.config
	if len(opts.Services) > 0 {
		cfg = wo.config.FilterServices(opts.Services)
		if len(cfg.Services) == 0 {
			return fmt.Errorf("no matching services found for: %v", opts.Services)
		}
	}

	// Set up signal handling for graceful shutdown
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Fprintln(wo.output, "\nShutting down file watcher...")
		cancel()
	}()

	// Create watcher
	watchOpts := watcher.Options{
		Extensions: opts.Extensions,
		DebounceMS: 300,
	}

	var err error
	wo.watcher, err = watcher.NewWatcher(cfg, wo.handleFileEvents(opts), watchOpts)
	if err != nil {
		return fmt.Errorf("failed to create file watcher: %w", err)
	}
	defer wo.watcher.Stop()

	// Start watching
	if err := wo.watcher.Start(ctx); err != nil {
		return fmt.Errorf("failed to start file watcher: %w", err)
	}

	if !opts.JSON {
		extensions := wo.watcher.GetWatchedExtensions()
		fmt.Fprintf(wo.output, "👀 Watching for changes in %s files...\n", fmt.Sprintf("%v", extensions))
		fmt.Fprintf(wo.output, "Press Ctrl+C to stop.\n\n")
	}

	// Wait for context cancellation
	<-ctx.Done()
	return nil
}

// handleFileEvents returns a handler function for file change events.
func (wo *WatchOrchestrator) handleFileEvents(opts WatchOptions) watcher.EventHandler {
	return func(events []watcher.FileEvent) error {
		if len(events) == 0 {
			return nil
		}

		// Group events by service
		serviceEvents := make(map[string][]watcher.FileEvent)
		for _, event := range events {
			serviceEvents[event.ServiceName] = append(serviceEvents[event.ServiceName], event)
		}

		// Process each service's events
		var results []runner.Result
		var resultsMutex sync.Mutex

		// Use a wait group for parallel processing
		var wg sync.WaitGroup
		for serviceName, events := range serviceEvents {
			wg.Add(1)
			go func(svcName string, svcEvents []watcher.FileEvent) {
				defer wg.Done()
				
				svcResults := wo.lintServiceFiles(svcName, svcEvents, opts)
				
				resultsMutex.Lock()
				results = append(results, svcResults...)
				resultsMutex.Unlock()
			}(serviceName, events)
		}

		wg.Wait()

		// Output results
		if opts.JSON {
			return wo.outputJSON(results)
		} else {
			return wo.outputText(results, opts.Verbose)
		}
	}
}

// lintServiceFiles lints files for a specific service.
func (wo *WatchOrchestrator) lintServiceFiles(serviceName string, events []watcher.FileEvent, opts WatchOptions) []runner.Result {
	if len(events) == 0 {
		return nil
	}

	service := events[0].Service // All events should have the same service
	var results []runner.Result

	for _, event := range events {
		result := wo.lintSingleFile(serviceName, service, event.Path, opts)
		results = append(results, result)
	}

	return results
}

// lintSingleFile lints a single file using the appropriate adapter.
func (wo *WatchOrchestrator) lintSingleFile(serviceName string, service *config.Service, filePath string, opts WatchOptions) runner.Result {
	// Determine if we should use spinners
	useSpinners := wo.shouldUseSpinners(opts)

	var spinner ui.Spinner
	if useSpinners {
		spinner = wo.spinnerFactory.NewSpinner(wo.output)
		spinner.Start(fmt.Sprintf("Linting %s", filePath))
		defer spinner.Stop()
	}

	// Create adapter based on service type
	switch service.Type {
	case "go":
		adapter := goadapter.New(serviceName, service.Dir, wo.commandRunner)
		return adapter.LintFile(filePath)
	case "node":
		adapter := nodeadapter.New(serviceName, service, wo.commandRunner)
		return adapter.LintFile(filePath)
	default:
		return runner.Result{
			Service:      serviceName,
			Phase:        runner.PhaseLint,
			Status:       runner.StatusError,
			ErrorMessage: fmt.Sprintf("Unsupported service type: %s", service.Type),
		}
	}
}

// outputJSON outputs results in JSON format.
func (wo *WatchOrchestrator) outputJSON(results []runner.Result) error {
	err := runner.OutputJSON(results, wo.output)
	if err != nil {
		return fmt.Errorf("failed to output JSON: %w", err)
	}
	return nil
}

// outputText outputs results in human-readable format.
func (wo *WatchOrchestrator) outputText(results []runner.Result, verbose bool) error {
	if len(results) == 0 {
		return nil
	}

	// Sort results by service name, then by file path
	sort.Slice(results, func(i, j int) bool {
		if results[i].Service != results[j].Service {
			return results[i].Service < results[j].Service
		}
		return results[i].Service < results[j].Service // Could add file path if available
	})

	// Group by status
	var successCount, failureCount, errorCount int
	for _, result := range results {
		switch result.Status {
		case runner.StatusSuccess:
			successCount++
		case runner.StatusFailure:
			failureCount++
		case runner.StatusError:
			errorCount++
		}
	}

	// Print timestamp and summary
	timestamp := wo.clock.Now().Format("15:04:05")
	fmt.Fprintf(wo.output, "[%s] Linted %d file(s): ", timestamp, len(results))
	
	if successCount > 0 {
		fmt.Fprintf(wo.output, "✅ %d passed", successCount)
	}
	if failureCount > 0 {
		if successCount > 0 {
			fmt.Fprint(wo.output, ", ")
		}
		fmt.Fprintf(wo.output, "❌ %d failed", failureCount)
	}
	if errorCount > 0 {
		if successCount > 0 || failureCount > 0 {
			fmt.Fprint(wo.output, ", ")
		}
		fmt.Fprintf(wo.output, "⚠️  %d error", errorCount)
	}
	fmt.Fprintln(wo.output)

	// Show failures if verbose or if there are failures
	if verbose || failureCount > 0 || errorCount > 0 {
		for _, result := range results {
			if result.Status == runner.StatusFailure || result.Status == runner.StatusError {
				fmt.Fprintf(wo.output, "\n%s (%s):\n", result.Service, result.Phase)
				
				if result.ErrorMessage != "" {
					fmt.Fprintf(wo.output, "  Error: %s\n", result.ErrorMessage)
				}
				
				for _, failure := range result.Failures {
					fmt.Fprintf(wo.output, "  • %s\n", failure.Message)
					if failure.File != "" && verbose {
						location := failure.File
						if failure.Line > 0 {
							location = fmt.Sprintf("%s:%d", failure.File, failure.Line)
						}
						fmt.Fprintf(wo.output, "    at %s\n", location)
					}
				}
			}
		}
	}

	fmt.Fprintln(wo.output) // Add spacing
	return nil
}

// shouldUseSpinners determines if spinners should be used.
func (wo *WatchOrchestrator) shouldUseSpinners(opts WatchOptions) bool {
	if opts.CI || opts.NoSpinner || opts.JSON {
		return false
	}
	return wo.ttyDetector.IsTerminal(uintptr(os.Stdout.Fd()))
}

