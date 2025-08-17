package parser

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// ESLintResult represents the structure of ESLint JSON output.
type ESLintResult []ESLintFile

// ESLintFile represents a single file in ESLint JSON output.
type ESLintFile struct {
	FilePath            string          `json:"filePath"`
	Messages            []ESLintMessage `json:"messages"`
	ErrorCount          int             `json:"errorCount"`
	WarningCount        int             `json:"warningCount"`
	FixableErrorCount   int             `json:"fixableErrorCount"`
	FixableWarningCount int             `json:"fixableWarningCount"`
	Source              string          `json:"source,omitempty"`
}

// ESLintMessage represents a single ESLint message (error or warning).
type ESLintMessage struct {
	RuleId    string     `json:"ruleId"`
	Severity  int        `json:"severity"`
	Message   string     `json:"message"`
	Line      int        `json:"line"`
	Column    int        `json:"column"`
	NodeType  string     `json:"nodeType,omitempty"`
	Source    string     `json:"source,omitempty"`
	EndLine   int        `json:"endLine,omitempty"`
	EndColumn int        `json:"endColumn,omitempty"`
	Fix       *ESLintFix `json:"fix,omitempty"`
}

// ESLintFix represents a fix suggestion from ESLint.
type ESLintFix struct {
	Range []int  `json:"range"`
	Text  string `json:"text"`
}

// ParseESLintJSON parses ESLint JSON output and returns lint results.
func ParseESLintJSON(output string) (*runner.Result, error) {
	if strings.TrimSpace(output) == "" {
		return &runner.Result{
			Status:       runner.StatusSuccess,
			Failures:     []runner.Failure{},
			WarningCount: 0,
		}, nil
	}

	var eslintResult ESLintResult
	if err := json.Unmarshal([]byte(output), &eslintResult); err != nil {
		return nil, fmt.Errorf("failed to parse ESLint JSON: %w", err)
	}

	result := &runner.Result{
		Status:       runner.StatusSuccess,
		Failures:     []runner.Failure{},
		WarningCount: 0,
	}

	var totalErrors int
	var totalWarnings int

	// Process each file
	for _, file := range eslintResult {
		totalErrors += file.ErrorCount
		totalWarnings += file.WarningCount

		// Process each message
		for _, message := range file.Messages {
			failure := runner.Failure{
				File:    file.FilePath,
				Line:    message.Line,
				Message: formatESLintMessage(message),
			}

			// Determine failure type based on severity
			if message.Severity == 2 { // Error
				failure.Type = "error"
				result.Failures = append(result.Failures, failure)
			} else if message.Severity == 1 { // Warning
				failure.Type = "warning"
				result.Failures = append(result.Failures, failure)
			}
		}
	}

	result.WarningCount = totalWarnings

	// Determine overall status
	if totalErrors > 0 {
		result.Status = runner.StatusFailure
	} else {
		result.Status = runner.StatusSuccess
	}

	return result, nil
}

// ParseESLintTextOutput parses ESLint text output for errors and warnings.
func ParseESLintTextOutput(output string) *runner.Result {
	result := &runner.Result{
		Status:       runner.StatusSuccess,
		Failures:     []runner.Failure{},
		WarningCount: 0,
	}

	if strings.TrimSpace(output) == "" {
		return result
	}

	lines := strings.Split(output, "\n")

	// Patterns for parsing ESLint text output
	messagePattern := regexp.MustCompile(`^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([^\s]+)$`)
	summaryPattern := regexp.MustCompile(`^✖\s+(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)`)

	var currentFile string
	var errorCount int

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Check if this is a summary line
		if matches := summaryPattern.FindStringSubmatch(line); len(matches) == 4 {
			if errors, err := strconv.Atoi(matches[2]); err == nil {
				errorCount = errors
			}
			if warnings, err := strconv.Atoi(matches[3]); err == nil {
				result.WarningCount = warnings
			}
			continue
		}

		// Check if this is a message line
		if matches := messagePattern.FindStringSubmatch(line); len(matches) == 6 {
			lineNum, _ := strconv.Atoi(matches[1])
			severity := matches[3]
			message := matches[4]
			rule := matches[5]

			failure := runner.Failure{
				File:    currentFile,
				Line:    lineNum,
				Message: fmt.Sprintf("%s (%s)", message, rule),
			}

			if severity == "error" {
				failure.Type = "error"
			} else {
				failure.Type = "warning"
			}

			result.Failures = append(result.Failures, failure)
			continue
		}

		// Check if this might be a file path
		if !strings.Contains(line, ":") && !strings.HasPrefix(line, " ") {
			// This might be a file path
			currentFile = line
		}
	}

	// Determine overall status
	if errorCount > 0 {
		result.Status = runner.StatusFailure
	}

	// Alternative parsing for different ESLint output formats
	if len(result.Failures) == 0 && strings.Contains(output, "error") {
		result = parseESLintAlternativeFormat(output)
	}

	return result
}

// parseESLintAlternativeFormat handles alternative ESLint output formats.
func parseESLintAlternativeFormat(output string) *runner.Result {
	result := &runner.Result{
		Status:       runner.StatusSuccess,
		Failures:     []runner.Failure{},
		WarningCount: 0,
	}

	lines := strings.Split(output, "\n")

	// Pattern for file:line:column format
	alternativePattern := regexp.MustCompile(`^(.+?):(\d+):(\d+):\s+(error|warning):\s+(.+)$`)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if matches := alternativePattern.FindStringSubmatch(line); len(matches) == 6 {
			lineNum, _ := strconv.Atoi(matches[2])
			severity := matches[4]
			message := matches[5]

			failure := runner.Failure{
				File:    matches[1],
				Line:    lineNum,
				Message: message,
				Type:    severity,
			}

			result.Failures = append(result.Failures, failure)

			if severity == "warning" {
				result.WarningCount++
			} else if severity == "error" {
				result.Status = runner.StatusFailure
			}
		}
	}

	return result
}

// formatESLintMessage formats an ESLint message for display.
func formatESLintMessage(message ESLintMessage) string {
	result := message.Message
	if message.RuleId != "" {
		result += fmt.Sprintf(" (%s)", message.RuleId)
	}
	return result
}
