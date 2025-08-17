package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// GoTestEvent represents a single event from go test -json output.
type GoTestEvent struct {
	Time    *time.Time `json:"Time,omitempty"`
	Action  string     `json:"Action"`
	Package string     `json:"Package,omitempty"`
	Test    string     `json:"Test,omitempty"`
	Output  string     `json:"Output,omitempty"`
	Elapsed *float64   `json:"Elapsed,omitempty"`
}

// ParseGoTestJSON parses the JSON output from go test -json and returns test results.
func ParseGoTestJSON(output string) (*runner.Result, error) {
	if strings.TrimSpace(output) == "" {
		return &runner.Result{
			Status:      runner.StatusSuccess,
			PassedCount: 0,
			FailedCount: 0,
		}, nil
	}

	result := &runner.Result{
		Status:      runner.StatusSuccess,
		PassedCount: 0,
		FailedCount: 0,
		Failures:    []runner.Failure{},
	}

	var totalElapsed float64
	packageResults := make(map[string]bool) // package -> passed
	testResults := make(map[string]bool)    // test -> passed
	testOutputs := make(map[string][]string) // test -> output lines

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var event GoTestEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			// Skip malformed JSON lines - go test sometimes outputs non-JSON
			continue
		}

		switch event.Action {
		case "pass":
			if event.Test != "" {
				// Individual test passed
				testResults[event.Package+"/"+event.Test] = true
				result.PassedCount++
			} else {
				// Package passed
				packageResults[event.Package] = true
			}
			if event.Elapsed != nil {
				totalElapsed += *event.Elapsed
			}

		case "fail":
			if event.Test != "" {
				// Individual test failed
				testResults[event.Package+"/"+event.Test] = false
				result.FailedCount++
				
				// Create failure from test output
				testKey := event.Package + "/" + event.Test
				outputs := testOutputs[testKey]
				message := strings.Join(outputs, "\n")
				if message == "" {
					message = "Test failed"
				}
				
				failure := runner.Failure{
					File:    extractFileFromOutput(outputs),
					Line:    extractLineFromOutput(outputs),
					Message: message,
					Type:    "test",
				}
				result.Failures = append(result.Failures, failure)
			} else {
				// Package failed
				packageResults[event.Package] = false
				result.Status = runner.StatusFailure
			}
			if event.Elapsed != nil {
				totalElapsed += *event.Elapsed
			}

		case "output":
			if event.Test != "" && event.Output != "" {
				// Store test output for failure messages
				testKey := event.Package + "/" + event.Test
				testOutputs[testKey] = append(testOutputs[testKey], event.Output)
			}

		case "skip":
			if event.Test != "" {
				// Test was skipped - count as passed for statistics
				testResults[event.Package+"/"+event.Test] = true
				result.PassedCount++
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading test output: %w", err)
	}

	// Set final status based on failures
	if result.FailedCount > 0 {
		result.Status = runner.StatusFailure
	}

	// Try to parse coverage from the output
	coverage := parseCoverageFromOutput(output)
	if coverage != nil {
		result.Coverage = coverage
	}

	return result, nil
}

// extractFileFromOutput tries to extract a filename from test output lines.
func extractFileFromOutput(outputs []string) string {
	for _, line := range outputs {
		line = strings.TrimSpace(line)
		// Look for patterns like "filename.go:123:" or "\tfilename.go:123"
		if strings.Contains(line, ".go:") {
			parts := strings.Fields(line)
			for _, part := range parts {
				if strings.Contains(part, ".go:") && !strings.HasPrefix(part, "go:") {
					// Find the .go: position
					goIdx := strings.Index(part, ".go:")
					if goIdx > 0 {
						return part[:goIdx+3] // Include ".go" but not the colon
					}
				}
			}
		}
	}
	return ""
}

// extractLineFromOutput tries to extract a line number from test output lines.
func extractLineFromOutput(outputs []string) int {
	for _, line := range outputs {
		line = strings.TrimSpace(line)
		// Look for patterns like "filename.go:123:" or "\tfilename.go:123"
		if strings.Contains(line, ".go:") {
			parts := strings.Fields(line)
			for _, part := range parts {
				if strings.Contains(part, ".go:") && !strings.HasPrefix(part, "go:") {
					// Find the .go: position
					goIdx := strings.Index(part, ".go:")
					if goIdx >= 0 {
						remaining := part[goIdx+4:] // Skip ".go:"
						// Find the next colon or end of string
						colonIdx := strings.Index(remaining, ":")
						var lineStr string
						if colonIdx >= 0 {
							lineStr = remaining[:colonIdx]
						} else {
							lineStr = remaining
						}
						if lineNum, err := strconv.Atoi(lineStr); err == nil {
							return lineNum
						}
					}
				}
			}
		}
	}
	return 0
}

// parseCoverageFromOutput attempts to parse coverage information from go test output.
func parseCoverageFromOutput(output string) *runner.Coverage {
	// Look for coverage lines like "coverage: 85.7% of statements"
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(line, "coverage:") && strings.Contains(line, "% of statements") {
			// Extract percentage
			parts := strings.Fields(line)
			for i, part := range parts {
				if strings.HasSuffix(part, "%") && i > 0 {
					percentStr := strings.TrimSuffix(part, "%")
					if percentage, err := strconv.ParseFloat(percentStr, 64); err == nil {
						return &runner.Coverage{
							Percentage: percentage,
							// Note: go test doesn't provide covered/total counts in the output
							// These would need to be parsed from coverage.out file
						}
					}
				}
			}
		}
	}
	return nil
}