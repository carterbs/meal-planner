package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

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

	// Parse flags
	flags := flag.NewFlagSet(os.Args[0], flag.ExitOnError)
	
	var opts orchestrator.Options
	var services stringSliceFlag
	
	flags.BoolVar(&opts.Verbose, "verbose", false, "Show detailed output")
	flags.BoolVar(&opts.JSON, "json", false, "Output results in JSON format")
	flags.BoolVar(&opts.NoSpinner, "no-spinner", false, "Disable spinner animations")
	flags.BoolVar(&opts.CI, "ci", false, "CI mode (implies --no-spinner, --json)")
	flags.Var(&services, "service", "Filter to specific services (can be used multiple times)")
	flags.StringVar(&opts.ConfigPath, "config", "", "Path to config file (default: .validate.yaml)")
	flags.IntVar(&opts.MaxParallel, "max-parallel", 0, "Maximum parallel jobs (default: GOMAXPROCS)")
	
	// Parse command line arguments (skip the command itself)
	if err := flags.Parse(os.Args[2:]); err != nil {
		os.Exit(1)
	}

	// Set phase and services
	opts.Phase = phase
	opts.Services = []string(services)

	// CI mode implies JSON and no spinner
	if opts.CI {
		opts.JSON = true
		opts.NoSpinner = true
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

func printHelp() {
	fmt.Print(`validate - Unified build tool for Go and TypeScript projects

Usage:
  validate [test|lint|build] [flags]

Commands:
  test     Run tests across all services
  lint     Run linters across all services  
  build    Build all services

Flags:
  --verbose      Show detailed output
  --json         Output results in JSON format
  --no-spinner   Disable spinner animations
  --ci           CI mode (implies --no-spinner, --json)
  --service      Filter to specific services (can be used multiple times)
  --config       Path to config file (default: .validate.yaml)
  --max-parallel Maximum parallel jobs (default: GOMAXPROCS)
  -h, --help     Show this help message

Examples:
  validate test
  validate lint --verbose
  validate build --service ui --service api-gateway
`)
}