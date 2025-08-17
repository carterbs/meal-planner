package parser

import (
	"bufio"
	"regexp"
	"strconv"
	"strings"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// ParseGoBuildOutput parses the output from go build and returns build results.
func ParseGoBuildOutput(output string) (*runner.Result, error) {
	result := &runner.Result{
		Status:   runner.StatusSuccess,
		Failures: []runner.Failure{},
	}

	if strings.TrimSpace(output) == "" {
		// Empty output usually means successful build
		return result, nil
	}

	// Parse build errors from stderr
	failures := parseBuildErrors(output)
	if len(failures) > 0 {
		result.Status = runner.StatusFailure
		result.Failures = failures
	}

	return result, nil
}

// parseBuildErrors parses build errors from Go compiler output.
func parseBuildErrors(output string) []runner.Failure {
	var failures []runner.Failure

	// Common Go compiler error patterns:
	// 1. filename.go:line:col: error message
	// 2. filename.go:line: error message
	// 3. # package-name
	//    filename.go:line:col: error message
	errorRegex := regexp.MustCompile(`^(.+\.go):(\d+):(?:(\d+):)?\s*(.+)$`)
	packageRegex := regexp.MustCompile(`^#\s+(.+)$`)

	var currentPackage string
	scanner := bufio.NewScanner(strings.NewReader(output))

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		// Check if this is a package line
		if packageMatches := packageRegex.FindStringSubmatch(line); packageMatches != nil {
			currentPackage = packageMatches[1]
			continue
		}

		// Check if this is an error line
		if errorMatches := errorRegex.FindStringSubmatch(line); errorMatches != nil {
			filename := errorMatches[1]
			lineNumStr := errorMatches[2]
			message := errorMatches[4]

			lineNum, err := strconv.Atoi(lineNumStr)
			if err != nil {
				lineNum = 0
			}

			// Clean up the filename - remove package prefix if present
			if currentPackage != "" && !strings.HasPrefix(filename, "/") && !strings.HasPrefix(filename, "./") {
				// This might be a relative filename within the package
				// Keep it as is for now
			}

			failure := runner.Failure{
				File:    filename,
				Line:    lineNum,
				Message: message,
				Type:    "build",
			}

			failures = append(failures, failure)
		} else {
			// Handle other error formats that don't match the regex
			if strings.Contains(line, "error") || strings.Contains(line, "Error") {
				// Generic error parsing
				failure := runner.Failure{
					File:    extractBuildFileFromLine(line),
					Line:    extractBuildLineFromLine(line),
					Message: line,
					Type:    "build",
				}
				failures = append(failures, failure)
			}
		}
	}

	return failures
}

// extractBuildFileFromLine tries to extract a filename from a build error line.
func extractBuildFileFromLine(line string) string {
	// Look for .go files in the line
	parts := strings.Fields(line)
	for _, part := range parts {
		if strings.Contains(part, ".go:") {
			// Find the .go: position
			goIdx := strings.Index(part, ".go:")
			if goIdx >= 0 {
				return part[:goIdx+3] // Include ".go" but not the colon
			}
		} else if strings.HasSuffix(part, ".go") {
			// Simple case: just ends with .go
			return part
		}
	}
	return ""
}

// extractBuildLineFromLine tries to extract a line number from a build error line.
func extractBuildLineFromLine(line string) int {
	// Look for patterns like "filename.go:123:"
	parts := strings.Fields(line)
	for _, part := range parts {
		if strings.Contains(part, ".go:") {
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
	return 0
}
