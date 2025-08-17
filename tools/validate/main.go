package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		printHelp()
		return
	}

	switch os.Args[1] {
	case "--help", "-h":
		printHelp()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		printHelp()
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
  --max-parallel Maximum parallel jobs
  -h, --help     Show this help message

Examples:
  validate test
  validate lint --verbose
  validate build --service ui --service api-gateway
`)
}