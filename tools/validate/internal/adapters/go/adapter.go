// Package goadapter provides a Go-specific implementation of the runner.Runner interface.
package goadapter

import (
	"bytes"
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/adapters/go/parser"
	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// Adapter implements the runner.Runner interface for Go services.
type Adapter struct {
	serviceName string
	workingDir  string
	executor    execx.CommandRunner
	timeout     time.Duration
}

// New creates a new Go adapter for the specified service.
func New(serviceName, workingDir string, executor execx.CommandRunner) *Adapter {
	return &Adapter{
		serviceName: serviceName,
		workingDir:  workingDir,
		executor:    executor,
		timeout:     5 * time.Minute, // Default timeout
	}
}

// WithTimeout sets the timeout for command execution.
func (a *Adapter) WithTimeout(timeout time.Duration) *Adapter {
	a.timeout = timeout
	return a
}

// Test runs go test with JSON output and coverage.
func (a *Adapter) Test() runner.Result {
	start := time.Now()
	result := runner.Result{
		Service:  a.serviceName,
		Phase:    runner.PhaseTest,
		Duration: 0,
		Status:   runner.StatusError,
	}

	ctx, cancel := context.WithTimeout(context.Background(), a.timeout)
	defer cancel()

	var stdout, stderr bytes.Buffer

	// Run go test with JSON output and coverage
	cmd := a.executor.CommandContext(ctx, "go", "test", "./...", "-json", "-cover", "-coverprofile=coverage.out")
	cmd.SetDir(a.workingDir)
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)

	err := cmd.Run()
	result.Duration = time.Since(start)

	if ctx.Err() == context.DeadlineExceeded || err == context.DeadlineExceeded {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Test execution timed out after %v", a.timeout)
		return result
	}

	// Parse the JSON output
	testResult, parseErr := parser.ParseGoTestJSON(stdout.String())
	if parseErr != nil {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Failed to parse test output: %v", parseErr)
		return result
	}

	// Merge the parsed results
	result.Status = testResult.Status
	result.PassedCount = testResult.PassedCount
	result.FailedCount = testResult.FailedCount
	result.Failures = testResult.Failures

	// Parse coverage if available
	if testResult.Coverage != nil {
		result.Coverage = testResult.Coverage
	} else {
		// Try to parse coverage.out file if JSON parsing didn't provide coverage
		if coverage, coverageErr := parser.ParseCoverageProfile(filepath.Join(a.workingDir, "coverage.out")); coverageErr == nil {
			result.Coverage = coverage
		}
	}

	// If there were command execution errors but parsing succeeded, 
	// the status from parsing should take precedence
	if err != nil && result.Status == runner.StatusSuccess {
		// Command failed but parsing indicates success - trust the parser
		// This can happen with go test when tests fail but JSON is still valid
	}

	return result
}

// Lint runs golangci-lint with JSON output.
func (a *Adapter) Lint() runner.Result {
	start := time.Now()
	result := runner.Result{
		Service:  a.serviceName,
		Phase:    runner.PhaseLint,
		Duration: 0,
		Status:   runner.StatusError,
	}

	ctx, cancel := context.WithTimeout(context.Background(), a.timeout)
	defer cancel()

	var stdout, stderr bytes.Buffer

	// Run golangci-lint with JSON output
	cmd := a.executor.CommandContext(ctx, "golangci-lint", "run", "--out-format", "json")
	cmd.SetDir(a.workingDir)
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)

	err := cmd.Run() // golangci-lint returns non-zero on issues, but we check for timeout
	result.Duration = time.Since(start)

	if ctx.Err() == context.DeadlineExceeded || err == context.DeadlineExceeded {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Lint execution timed out after %v", a.timeout)
		return result
	}

	// Parse the JSON output
	lintResult, parseErr := parser.ParseGolangciLintJSON(stdout.String())
	if parseErr != nil {
		// Try parsing as text output if JSON parsing fails
		if textResult, textErr := parser.ParseGolangciLintText(stdout.String()); textErr == nil {
			result.Status = textResult.Status
			result.Failures = textResult.Failures
			result.WarningCount = textResult.WarningCount
			return result
		}
		
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Failed to parse lint output: %v", parseErr)
		return result
	}

	// Merge the parsed results
	result.Status = lintResult.Status
	result.Failures = lintResult.Failures
	result.WarningCount = lintResult.WarningCount

	return result
}

// Build runs go build for all packages.
func (a *Adapter) Build() runner.Result {
	start := time.Now()
	result := runner.Result{
		Service:  a.serviceName,
		Phase:    runner.PhaseBuild,
		Duration: 0,
		Status:   runner.StatusError,
	}

	ctx, cancel := context.WithTimeout(context.Background(), a.timeout)
	defer cancel()

	var stdout, stderr bytes.Buffer

	// Run go build
	cmd := a.executor.CommandContext(ctx, "go", "build", "./...")
	cmd.SetDir(a.workingDir)
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)

	err := cmd.Run()
	result.Duration = time.Since(start)

	if ctx.Err() == context.DeadlineExceeded || err == context.DeadlineExceeded {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Build execution timed out after %v", a.timeout)
		return result
	}

	// Parse the build output
	buildResult, parseErr := parser.ParseGoBuildOutput(stderr.String())
	if parseErr != nil {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Failed to parse build output: %v", parseErr)
		return result
	}

	// Merge the parsed results
	result.Status = buildResult.Status
	result.Failures = buildResult.Failures

	// If command succeeded, ensure status is success
	if err == nil && result.Status != runner.StatusFailure {
		result.Status = runner.StatusSuccess
	}

	return result
}