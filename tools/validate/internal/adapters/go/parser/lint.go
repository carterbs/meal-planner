package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// GolangciLintResult represents the JSON output from golangci-lint.
type GolangciLintResult struct {
	Issues []GolangciLintIssue `json:"Issues"`
}

// GolangciLintIssue represents a single issue from golangci-lint.
type GolangciLintIssue struct {
	FromLinter  string                   `json:"FromLinter"`
	Text        string                   `json:"Text"`
	Severity    string                   `json:"Severity"`
	SourceLines []string                 `json:"SourceLines"`
	Replacement *GolangciLintReplacement `json:"Replacement"`
	Pos         GolangciLintPos          `json:"Pos"`
}

// GolangciLintReplacement represents a suggested replacement.
type GolangciLintReplacement struct {
	NeedOnlyDelete bool     `json:"NeedOnlyDelete"`
	NewLines       []string `json:"NewLines"`
}

// GolangciLintPos represents the position of an issue.
type GolangciLintPos struct {
	Filename string `json:"Filename"`
	Offset   int    `json:"Offset"`
	Line     int    `json:"Line"`
	Column   int    `json:"Column"`
}

// ParseGolangciLintJSON parses JSON output from golangci-lint.
func ParseGolangciLintJSON(output string) (*runner.Result, error) {
	if strings.TrimSpace(output) == "" {
		return &runner.Result{
			Status:       runner.StatusSuccess,
			Failures:     []runner.Failure{},
			WarningCount: 0,
		}, nil
	}

	var lintResult GolangciLintResult
	if err := json.Unmarshal([]byte(output), &lintResult); err != nil {
		return nil, fmt.Errorf("failed to parse golangci-lint JSON: %w", err)
	}

	result := &runner.Result{
		Status:       runner.StatusSuccess,
		Failures:     []runner.Failure{},
		WarningCount: 0,
	}

	errorCount := 0
	for _, issue := range lintResult.Issues {
		failure := runner.Failure{
			File:    issue.Pos.Filename,
			Line:    issue.Pos.Line,
			Message: fmt.Sprintf("[%s] %s", issue.FromLinter, issue.Text),
		}

		// Determine if this is an error or warning based on severity
		switch strings.ToLower(issue.Severity) {
		case "error":
			failure.Type = "error"
			errorCount++
		case "warning":
			failure.Type = "warning"
			result.WarningCount++
		default:
			// Default to error for unknown severities
			failure.Type = "error"
			errorCount++
		}

		result.Failures = append(result.Failures, failure)
	}

	// Set status based on whether there are errors
	if errorCount > 0 {
		result.Status = runner.StatusFailure
	}

	return result, nil
}

// ParseGolangciLintText parses text output from golangci-lint as a fallback.
func ParseGolangciLintText(output string) (*runner.Result, error) {
	if strings.TrimSpace(output) == "" {
		return &runner.Result{
			Status:       runner.StatusSuccess,
			Failures:     []runner.Failure{},
			WarningCount: 0,
		}, nil
	}

	result := &runner.Result{
		Status:       runner.StatusSuccess,
		Failures:     []runner.Failure{},
		WarningCount: 0,
	}

	// Regex to match golangci-lint text output format:
	// filename.go:line:col: message (linter)
	// or
	// filename.go:line: message (linter)
	lineRegex := regexp.MustCompile(`^(.+\.go):(\d+):(?:\d+:)?\s*(.+?)\s*\(([^)]+)\)`)

	errorCount := 0
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		matches := lineRegex.FindStringSubmatch(line)
		if len(matches) >= 5 {
			filename := matches[1]
			lineNumStr := matches[2]
			message := matches[3]
			linter := matches[4]

			lineNum, err := strconv.Atoi(lineNumStr)
			if err != nil {
				lineNum = 0
			}

			failure := runner.Failure{
				File:    filename,
				Line:    lineNum,
				Message: fmt.Sprintf("[%s] %s", linter, message),
				Type:    "error", // Default to error since text output doesn't distinguish
			}

			result.Failures = append(result.Failures, failure)
			errorCount++
		} else {
			// Try to parse simpler formats or treat as generic error
			if strings.Contains(line, ".go:") {
				failure := runner.Failure{
					File:    extractFileFromText(line),
					Line:    extractLineFromText(line),
					Message: line,
					Type:    "error",
				}
				result.Failures = append(result.Failures, failure)
				errorCount++
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading lint output: %w", err)
	}

	// Set status based on whether there are errors
	if errorCount > 0 {
		result.Status = runner.StatusFailure
	}

	return result, nil
}

// extractFileFromText extracts filename from a text line.
func extractFileFromText(line string) string {
	parts := strings.Fields(line)
	for _, part := range parts {
		if strings.Contains(part, ".go:") {
			if colonIdx := strings.Index(part, ":"); colonIdx > 0 {
				return part[:colonIdx]
			}
		}
	}
	return ""
}

// extractLineFromText extracts line number from a text line.
func extractLineFromText(line string) int {
	parts := strings.Fields(line)
	for _, part := range parts {
		if strings.Contains(part, ".go:") {
			if colonIdx := strings.Index(part, ":"); colonIdx > 0 {
				remaining := part[colonIdx+1:]
				if nextColonIdx := strings.Index(remaining, ":"); nextColonIdx > 0 {
					lineStr := remaining[:nextColonIdx]
					if lineNum, err := strconv.Atoi(lineStr); err == nil {
						return lineNum
					}
				}
			}
		}
	}
	return 0
}
