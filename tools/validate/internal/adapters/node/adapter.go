// Package nodeadapter provides a Node.js-specific implementation of the runner.Runner interface.
package nodeadapter

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/adapters/node/parser"
	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// Adapter implements the runner.Runner interface for Node.js services.
type Adapter struct {
	serviceName string
	service     *config.Service
	executor    execx.CommandRunner
	timeout     time.Duration
	jsonMode    bool
}

// New creates a new Node adapter for the specified service.
func New(serviceName string, service *config.Service, executor execx.CommandRunner) *Adapter {
	return &Adapter{
		serviceName: serviceName,
		service:     service,
		executor:    executor,
		timeout:     5 * time.Minute, // Default timeout
		jsonMode:    false,
	}
}

// WithTimeout sets the timeout for command execution.
func (a *Adapter) WithTimeout(timeout time.Duration) *Adapter {
	a.timeout = timeout
	return a
}

// WithJSONMode enables JSON output mode.
func (a *Adapter) WithJSONMode(enabled bool) *Adapter {
	a.jsonMode = enabled
	return a
}

// Test runs Jest tests with optional JSON output.
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

	testCmd := a.service.GetTestCommand()
	if testCmd == "" {
		result.Duration = time.Since(start)
		result.ErrorMessage = "No test command configured"
		return result
	}

	// If JSON mode is enabled, try to run with JSON output
	if a.jsonMode {
		if jsonResult, err := a.runTestWithJSON(ctx, testCmd); err == nil {
			jsonResult.Duration = time.Since(start)
			return jsonResult
		}
		// If JSON mode fails, fall back to regular mode
	}

	// Run regular test command
	result = a.runTestCommand(ctx, testCmd)
	result.Duration = time.Since(start)
	return result
}

// runTestWithJSON attempts to run tests with JSON output by re-running with JSON flags.
func (a *Adapter) runTestWithJSON(ctx context.Context, testCmd string) (runner.Result, error) {
	result := runner.Result{
		Service: a.serviceName,
		Phase:   runner.PhaseTest,
		Status:  runner.StatusError,
	}

	// Create a temporary file for JSON output
	tempFile, err := os.CreateTemp("", "jest-output-*.json")
	if err != nil {
		return result, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	// Parse the test command and add JSON flags
	parts := strings.Fields(testCmd)
	if len(parts) == 0 {
		return result, fmt.Errorf("empty test command")
	}

	// Add JSON output flags for Jest
	jsonArgs := append(parts, "--json", "--outputFile="+tempFile.Name())

	var stdout, stderr bytes.Buffer
	cmd := a.executor.CommandContext(ctx, jsonArgs[0], jsonArgs[1:]...)
	if a.service.Dir != "" {
		cmd.SetDir(a.service.Dir)
	}
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)

	err = cmd.Run()

	if ctx.Err() == context.DeadlineExceeded || err == context.DeadlineExceeded {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Test execution timed out after %v", a.timeout)
		return result, fmt.Errorf("timeout")
	}

	// Read the JSON output file
	jsonData, readErr := os.ReadFile(tempFile.Name())
	if readErr != nil {
		return result, fmt.Errorf("failed to read JSON output: %w", readErr)
	}

	// Parse the JSON output
	parsedResult, parseErr := parser.ParseJestJSON(string(jsonData))
	if parseErr != nil {
		return result, fmt.Errorf("failed to parse Jest JSON: %w", parseErr)
	}

	// Merge the parsed results
	result.Status = parsedResult.Status
	result.PassedCount = parsedResult.PassedCount
	result.FailedCount = parsedResult.FailedCount
	result.Failures = parsedResult.Failures
	result.Coverage = parsedResult.Coverage

	return result, nil
}

// runTestCommand runs the test command in regular mode with failure extraction.
func (a *Adapter) runTestCommand(ctx context.Context, testCmd string) runner.Result {
	result := runner.Result{
		Service: a.serviceName,
		Phase:   runner.PhaseTest,
		Status:  runner.StatusError,
	}

	parts := strings.Fields(testCmd)
	if len(parts) == 0 {
		result.ErrorMessage = "Empty test command"
		return result
	}

	// For quiet mode, ensure we use jest-silent-reporter or similar
	if !a.containsReporter(parts) {
		// Add silent reporter for Jest if no reporter is specified
		if a.isJestCommand(parts) {
			parts = append(parts, "--reporters=jest-silent-reporter")
		}
	}

	var stdout, stderr bytes.Buffer
	cmd := a.executor.CommandContext(ctx, parts[0], parts[1:]...)
	if a.service.Dir != "" {
		cmd.SetDir(a.service.Dir)
	}
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)

	err := cmd.Run()

	if ctx.Err() == context.DeadlineExceeded || err == context.DeadlineExceeded {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Test execution timed out after %v", a.timeout)
		return result
	}

	// Parse the test output for failures
	output := stdout.String() + stderr.String()
	parsedResult := parser.ParseJestTextOutput(output)

	result.Status = parsedResult.Status
	result.PassedCount = parsedResult.PassedCount
	result.FailedCount = parsedResult.FailedCount
	result.Failures = parsedResult.Failures

	// If command succeeded but we found failures, status should be failure
	if err == nil && len(result.Failures) == 0 {
		result.Status = runner.StatusSuccess
	} else if len(result.Failures) > 0 {
		result.Status = runner.StatusFailure
	}

	// Try to parse coverage from coverage-summary.json if available
	if a.service.Dir != "" {
		coveragePath := filepath.Join(a.service.Dir, "coverage", "coverage-summary.json")
		if coverage, coverageErr := parser.ParseJestCoverage(coveragePath); coverageErr == nil {
			result.Coverage = coverage
		}
	}

	return result
}

// Lint runs ESLint with optional JSON output.
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

	lintCmd := a.service.GetLintCommand()
	if lintCmd == "" {
		result.Duration = time.Since(start)
		result.ErrorMessage = "No lint command configured"
		return result
	}

	parts := strings.Fields(lintCmd)
	if len(parts) == 0 {
		result.Duration = time.Since(start)
		result.ErrorMessage = "Empty lint command"
		return result
	}

	// Add JSON format for ESLint if in JSON mode
	if a.jsonMode && a.isESLintCommand(parts) {
		if !a.containsFormat(parts) {
			parts = append(parts, "--format=json")
		}
	} else {
		// Ensure quiet mode for non-JSON output
		if !a.containsQuiet(parts) && a.isESLintCommand(parts) {
			parts = append(parts, "--quiet")
		}
	}

	var stdout, stderr bytes.Buffer
	cmd := a.executor.CommandContext(ctx, parts[0], parts[1:]...)
	if a.service.Dir != "" {
		cmd.SetDir(a.service.Dir)
	}
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)

	err := cmd.Run() // ESLint returns non-zero on issues
	result.Duration = time.Since(start)

	if ctx.Err() == context.DeadlineExceeded || err == context.DeadlineExceeded {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Lint execution timed out after %v", a.timeout)
		return result
	}

	output := stdout.String()
	
	// Try to parse as JSON first if in JSON mode
	if a.jsonMode {
		if parsedResult, parseErr := parser.ParseESLintJSON(output); parseErr == nil {
			result.Status = parsedResult.Status
			result.Failures = parsedResult.Failures
			result.WarningCount = parsedResult.WarningCount
			return result
		}
	}

	// Fallback to text parsing
	parsedResult := parser.ParseESLintTextOutput(output)
	result.Status = parsedResult.Status
	result.Failures = parsedResult.Failures
	result.WarningCount = parsedResult.WarningCount

	// If command succeeded and no issues found, mark as success
	if err == nil && len(result.Failures) == 0 {
		result.Status = runner.StatusSuccess
	}

	return result
}

// Build runs the configured build command.
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

	buildCmd := a.service.GetBuildCommand()
	if buildCmd == "" {
		result.Duration = time.Since(start)
		result.ErrorMessage = "No build command configured"
		return result
	}

	parts := strings.Fields(buildCmd)
	if len(parts) == 0 {
		result.Duration = time.Since(start)
		result.ErrorMessage = "Empty build command"
		return result
	}

	var stdout, stderr bytes.Buffer
	cmd := a.executor.CommandContext(ctx, parts[0], parts[1:]...)
	if a.service.Dir != "" {
		cmd.SetDir(a.service.Dir)
	}
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)

	err := cmd.Run()
	result.Duration = time.Since(start)

	if ctx.Err() == context.DeadlineExceeded || err == context.DeadlineExceeded {
		result.Status = runner.StatusError
		result.ErrorMessage = fmt.Sprintf("Build execution timed out after %v", a.timeout)
		return result
	}

	// Parse the build output for failures
	output := stderr.String() + stdout.String()
	parsedResult := parser.ParseBuildOutput(output)

	result.Status = parsedResult.Status
	result.Failures = parsedResult.Failures

	// If command succeeded, ensure status is success
	if err == nil && result.Status != runner.StatusFailure {
		result.Status = runner.StatusSuccess
	}

	return result
}

// Helper methods

func (a *Adapter) containsReporter(parts []string) bool {
	for _, part := range parts {
		if strings.Contains(part, "--reporter") || strings.Contains(part, "--reporters") {
			return true
		}
	}
	return false
}

func (a *Adapter) containsFormat(parts []string) bool {
	for _, part := range parts {
		if strings.Contains(part, "--format") || strings.Contains(part, "-f") {
			return true
		}
	}
	return false
}

func (a *Adapter) containsQuiet(parts []string) bool {
	for _, part := range parts {
		if strings.Contains(part, "--quiet") || strings.Contains(part, "-q") {
			return true
		}
	}
	return false
}

func (a *Adapter) isJestCommand(parts []string) bool {
	return len(parts) > 0 && (strings.Contains(parts[0], "jest") || 
		(len(parts) > 1 && strings.Contains(parts[1], "jest")))
}

func (a *Adapter) isESLintCommand(parts []string) bool {
	return len(parts) > 0 && (strings.Contains(parts[0], "eslint") || 
		(len(parts) > 1 && strings.Contains(parts[1], "eslint")))
}