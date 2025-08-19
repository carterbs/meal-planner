package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	goadapter "github.com/bradcarter-meal-planner/tools/validate/internal/adapters/go"
	nodeadapter "github.com/bradcarter-meal-planner/tools/validate/internal/adapters/node"
	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
	"github.com/bradcarter-meal-planner/tools/validate/internal/orchestrator"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
	"github.com/bradcarter-meal-planner/tools/validate/internal/ui"
)

// stringSliceFlag implements flag.Value for accumulating multiple string values.
type stringSliceFlag []string

func (s *stringSliceFlag) String() string {
	return strings.Join(*s, ",")
}

func (s *stringSliceFlag) Set(value string) error {
	*s = append(*s, value)
	return nil
}

// parseLintFileFlags parses CLI flags for the lint-file command and returns file path and orchestrator options.
func parseLintFileFlags(args []string) (string, orchestrator.Options, error) {
	var opts orchestrator.Options

	flags := flag.NewFlagSet("validate lint-file", flag.ContinueOnError)
	flags.BoolVar(&opts.Verbose, "verbose", false, "Show detailed output")
	flags.BoolVar(&opts.JSON, "json", false, "Output results in JSON format")
	flags.BoolVar(&opts.NoSpinner, "no-spinner", false, "Disable spinner animations")
	flags.BoolVar(&opts.CI, "ci", false, "CI mode (implies --no-spinner, --json)")
	flags.StringVar(&opts.ConfigPath, "config", "", "Path to config file (default: .validate.yaml)")

	if err := flags.Parse(args); err != nil {
		return "", opts, err
	}

	// Get the file path from remaining args
	if len(flags.Args()) != 1 {
		return "", opts, fmt.Errorf("lint-file requires exactly one file path argument")
	}

	filePath := flags.Args()[0]
	opts.Phase = runner.PhaseLint

	if opts.CI {
		opts.JSON = true
		opts.NoSpinner = true
	}

	return filePath, opts, nil
}

// parseFlags parses CLI flags for a given phase and returns orchestrator options.
func parseFlags(phase runner.Phase, args []string) (orchestrator.Options, error) {
	var opts orchestrator.Options
	var services stringSliceFlag

	flags := flag.NewFlagSet("validate", flag.ContinueOnError)
	flags.BoolVar(&opts.Verbose, "verbose", false, "Show detailed output")
	flags.BoolVar(&opts.JSON, "json", false, "Output results in JSON format")
	flags.BoolVar(&opts.NoSpinner, "no-spinner", false, "Disable spinner animations")
	flags.BoolVar(&opts.CI, "ci", false, "CI mode (implies --no-spinner, --json)")
	flags.Var(&services, "service", "Filter to specific services (can be used multiple times)")
	flags.StringVar(&opts.ConfigPath, "config", "", "Path to config file (default: .validate.yaml)")
	flags.IntVar(&opts.MaxParallel, "max-parallel", 0, "Maximum parallel jobs (default: GOMAXPROCS)")

	if err := flags.Parse(args); err != nil {
		return opts, err
	}

	opts.Phase = phase
	opts.Services = []string(services)

	if opts.CI {
		opts.JSON = true
		opts.NoSpinner = true
	}

	return opts, nil
}

// parseWatchFlags parses CLI flags for the watch command and returns watch orchestrator options.
func parseWatchFlags(args []string) (orchestrator.WatchOptions, error) {
	var opts orchestrator.WatchOptions
	var services stringSliceFlag
	var extensions stringSliceFlag

	flags := flag.NewFlagSet("validate watch", flag.ContinueOnError)
	flags.BoolVar(&opts.Verbose, "verbose", false, "Show detailed output")
	flags.BoolVar(&opts.JSON, "json", false, "Output results in JSON format")
	flags.BoolVar(&opts.NoSpinner, "no-spinner", false, "Disable spinner animations")
	flags.BoolVar(&opts.CI, "ci", false, "CI mode (implies --no-spinner, --json)")
	flags.Var(&services, "service", "Filter to specific services (can be used multiple times)")
	flags.Var(&extensions, "extensions", "File extensions to watch (can be used multiple times, e.g., .go,.ts)")
	flags.StringVar(&opts.ConfigPath, "config", "", "Path to config file (default: .validate.yaml)")
	flags.IntVar(&opts.MaxParallel, "max-parallel", 0, "Maximum parallel jobs (default: GOMAXPROCS)")

	if err := flags.Parse(args); err != nil {
		return opts, err
	}

	opts.Services = []string(services)
	opts.Extensions = []string(extensions)

	if opts.CI {
		opts.JSON = true
		opts.NoSpinner = true
	}

	return opts, nil
}

func main() {
	if len(os.Args) < 2 {
		printHelp()
		os.Exit(1)
	}

	command := os.Args[1]

	// Handle help
	if command == "--help" || command == "-h" || command == "help" {
		printHelp()
		return
	}

	// Handle lint-file command
	if command == "lint-file" {
		filePath, opts, err := parseLintFileFlags(os.Args[2:])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse flags: %v\n", err)
			os.Exit(1)
		}

		// Load configuration
		loader := config.NewLoader(opts.ConfigPath)
		cfg, err := loader.Load()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
			os.Exit(1)
		}

		// Create dependencies
		commandRunner := execx.NewRealCommandRunner()

		// Execute lint-file
		ctx := context.Background()
		result, err := lintFile(ctx, cfg, commandRunner, filePath)
		if err != nil {
			if !opts.JSON && !opts.CI {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			}
			os.Exit(1)
		}

		// Output result
		if opts.JSON {
			if err := outputJSON(result); err != nil {
				fmt.Fprintf(os.Stderr, "Error outputting JSON: %v\n", err)
				os.Exit(1)
			}
		} else {
			outputText(result, opts.Verbose)
		}

		// Exit with appropriate code
		if result.Status == runner.StatusFailure || result.Status == runner.StatusError {
			os.Exit(2)
		}
		return
	}

	// Handle watch command separately
	if command == "watch" {
		watchOpts, err := parseWatchFlags(os.Args[2:])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse flags: %v\n", err)
			os.Exit(1)
		}

		// Load configuration
		loader := config.NewLoader(watchOpts.ConfigPath)
		cfg, err := loader.Load()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
			os.Exit(1)
		}

		// Create dependencies
		commandRunner := execx.NewRealCommandRunner()
		spinnerFactory := ui.NewRealSpinnerFactory()
		ttyDetector := ui.NewRealTTYDetector()
		clock := ui.NewRealClock()

		// Create watch orchestrator
		watchOrch := orchestrator.NewWatchOrchestrator(
			cfg,
			commandRunner,
			spinnerFactory,
			ttyDetector,
			clock,
			os.Stdout,
			os.Stderr,
		)

		// Execute watch
		ctx := context.Background()
		if err := watchOrch.Watch(ctx, watchOpts); err != nil {
			if !watchOpts.JSON && !watchOpts.CI {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			}
			os.Exit(1)
		}
		return
	}

	// Validate command
	var phase runner.Phase
	switch command {
	case "test":
		phase = runner.PhaseTest
	case "lint":
		phase = runner.PhaseLint
	case "build":
		phase = runner.PhaseBuild
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", command)
		printHelp()
		os.Exit(1)
	}

	opts, err := parseFlags(phase, os.Args[2:])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to parse flags: %v\n", err)
		os.Exit(1)
	}

	// Load configuration
	loader := config.NewLoader(opts.ConfigPath)
	cfg, err := loader.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
		os.Exit(1)
	}

	// Create dependencies
	commandRunner := execx.NewRealCommandRunner()
	spinnerFactory := ui.NewRealSpinnerFactory()
	ttyDetector := ui.NewRealTTYDetector()
	clock := ui.NewRealClock()

	// Create orchestrator
	orch := orchestrator.New(
		cfg,
		commandRunner,
		spinnerFactory,
		ttyDetector,
		clock,
		os.Stdout,
		os.Stderr,
	)

	// Execute
	ctx := context.Background()
	if err := orch.Execute(ctx, opts); err != nil {
		if !opts.JSON && !opts.CI {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		}
		os.Exit(1)
	}
}

// lintFile lints a single file by determining which service it belongs to.
func lintFile(ctx context.Context, cfg *config.Config, commandRunner execx.CommandRunner, filePath string) (runner.Result, error) {
	// Convert to absolute path
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return runner.Result{}, fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Find which service this file belongs to
	service, err := findServiceForFile(cfg, absPath)
	if err != nil {
		return runner.Result{}, err
	}

	// Route to appropriate adapter based on service type
	switch service.Type {
	case config.ServiceTypeGo:
		adapter := goadapter.New(service.Name, service.Dir, commandRunner)
		return adapter.LintFile(absPath), nil
	case config.ServiceTypeNode:
		adapter := nodeadapter.New(service.Name, service, commandRunner)
		return adapter.LintFile(absPath), nil
	default:
		return runner.Result{}, fmt.Errorf("unsupported service type: %s", service.Type)
	}
}

// findServiceForFile determines which service a file belongs to based on its path.
func findServiceForFile(cfg *config.Config, filePath string) (*config.Service, error) {
	var bestMatch *config.Service
	var bestMatchLen int

	for i := range cfg.Services {
		service := &cfg.Services[i]

		// Get absolute service directory
		serviceDir := service.Dir
		if serviceDir == "" {
			continue
		}

		if !filepath.IsAbs(serviceDir) {
			absDir, err := filepath.Abs(serviceDir)
			if err != nil {
				continue
			}
			serviceDir = absDir
		}

		// Check if file is within this service directory
		relPath, err := filepath.Rel(serviceDir, filePath)
		if err != nil {
			continue
		}

		// If relative path doesn't start with "..", the file is within this service
		if !strings.HasPrefix(relPath, "..") {
			// Find the service with the longest matching path (most specific)
			if len(serviceDir) > bestMatchLen {
				bestMatch = service
				bestMatchLen = len(serviceDir)
			}
		}
	}

	if bestMatch == nil {
		return nil, fmt.Errorf("no service found for file: %s", filePath)
	}

	return bestMatch, nil
}

// outputJSON outputs the result in JSON format.
func outputJSON(result runner.Result) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(result)
}

// outputText outputs the result in human-readable format.
func outputText(result runner.Result, verbose bool) {
	switch result.Status {
	case runner.StatusSuccess:
		if verbose {
			fmt.Printf("✓ %s lint passed\n", result.Service)
		}
	case runner.StatusFailure:
		fmt.Fprintf(os.Stderr, "✗ %s lint failed\n", result.Service)
		if len(result.Failures) > 0 {
			for _, failure := range result.Failures {
				if failure.File != "" && failure.Line > 0 {
					fmt.Fprintf(os.Stderr, "  %s:%d %s\n", failure.File, failure.Line, failure.Message)
				} else if failure.File != "" {
					fmt.Fprintf(os.Stderr, "  %s: %s\n", failure.File, failure.Message)
				} else {
					fmt.Fprintf(os.Stderr, "  %s\n", failure.Message)
				}
			}
		}
	case runner.StatusError:
		fmt.Fprintf(os.Stderr, "✗ %s lint error: %s\n", result.Service, result.ErrorMessage)
	}
}

func printHelp() {
	fmt.Print(`validate - Unified build tool for Go and TypeScript projects

Usage:
  validate [test|lint|build|watch|lint-file] [flags]

Commands:
  test       Run tests across all services
  lint       Run linters across all services  
  build      Build all services
  watch      Watch for file changes and run linters automatically
  lint-file  Lint a single file by routing to appropriate service linter

Flags:
  --verbose      Show detailed output
  --json         Output results in JSON format
  --no-spinner   Disable spinner animations
  --ci           CI mode (implies --no-spinner, --json)
  --service      Filter to specific services (can be used multiple times)
  --config       Path to config file (default: .validate.yaml)
  --max-parallel Maximum parallel jobs (default: GOMAXPROCS)
  -h, --help     Show this help message

Watch-specific flags:
  --extensions   File extensions to watch (default: .go,.ts,.tsx,.js,.jsx)

Examples:
  validate test
  validate lint --verbose
  validate build --service ui --service api-gateway
  validate watch
  validate watch --service ui --extensions .ts,.tsx
  validate lint-file ./ui/src/components/Header.tsx
  validate lint-file ./meal-service/main.go --json
`)
}
