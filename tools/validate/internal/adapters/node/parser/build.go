package parser

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// ParseBuildOutput parses build output from various Node.js build tools (Webpack, Vite, TypeScript, etc.).
func ParseBuildOutput(output string) *runner.Result {
	result := &runner.Result{
		Status:   runner.StatusSuccess,
		Failures: []runner.Failure{},
	}

	if strings.TrimSpace(output) == "" {
		return result
	}

	// Try different parsers in order of specificity
	if webpackResult := parseWebpackOutput(output); len(webpackResult.Failures) > 0 {
		return webpackResult
	}

	if viteResult := parseViteOutput(output); len(viteResult.Failures) > 0 {
		return viteResult
	}

	if tscResult := parseTypeScriptOutput(output); len(tscResult.Failures) > 0 {
		return tscResult
	}

	// Generic error parsing as fallback
	return parseGenericBuildOutput(output)
}

// parseWebpackOutput parses Webpack build errors.
func parseWebpackOutput(output string) *runner.Result {
	result := &runner.Result{
		Status:   runner.StatusSuccess,
		Failures: []runner.Failure{},
	}

	lines := strings.Split(output, "\n")
	
	// Patterns for Webpack errors
	errorPattern := regexp.MustCompile(`^ERROR in (.+?)$`)
	moduleErrorPattern := regexp.MustCompile(`^Module build failed \(from (.+?)\):`)
	
	var currentFile string
	var inErrorBlock bool
	var errorLines []string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		
		// Check for error start
		if matches := errorPattern.FindStringSubmatch(line); len(matches) > 1 {
			currentFile = matches[1]
			inErrorBlock = true
			errorLines = []string{}
			continue
		}

		// Check for module build failed
		if matches := moduleErrorPattern.FindStringSubmatch(line); len(matches) > 1 {
			inErrorBlock = true
			errorLines = []string{}
			continue
		}

		// Collect error lines
		if inErrorBlock {
			if line == "" || strings.HasPrefix(line, "ERROR in") {
				// End of current error block
				if len(errorLines) > 0 && currentFile != "" {
					failure := runner.Failure{
						File:    extractFileName(currentFile),
						Type:    "error",
						Message: extractErrorMessage(errorLines),
					}
					
					// Try to extract line number
					if lineNum := extractLineNumber(currentFile, errorLines); lineNum > 0 {
						failure.Line = lineNum
					}
					
					result.Failures = append(result.Failures, failure)
				}
				inErrorBlock = false
				currentFile = ""
				errorLines = []string{}
			} else {
				errorLines = append(errorLines, line)
			}
		}
	}

	// Handle last error block
	if inErrorBlock && len(errorLines) > 0 && currentFile != "" {
		failure := runner.Failure{
			File:    extractFileName(currentFile),
			Type:    "error",
			Message: extractErrorMessage(errorLines),
		}
		
		if lineNum := extractLineNumber(currentFile, errorLines); lineNum > 0 {
			failure.Line = lineNum
		}
		
		result.Failures = append(result.Failures, failure)
	}

	if len(result.Failures) > 0 {
		result.Status = runner.StatusFailure
	}

	return result
}

// parseViteOutput parses Vite build errors.
func parseViteOutput(output string) *runner.Result {
	result := &runner.Result{
		Status:   runner.StatusSuccess,
		Failures: []runner.Failure{},
	}

	lines := strings.Split(output, "\n")
	
	// Patterns for Vite errors
	viteErrorPattern := regexp.MustCompile(`^(.+?):(\d+):(\d+): error: (.+)$`)
	
	for i, line := range lines {
		line = strings.TrimSpace(line)
		
		// Check for Vite error pattern
		if matches := viteErrorPattern.FindStringSubmatch(line); len(matches) == 5 {
			lineNum := parseInt(matches[2])
			
			failure := runner.Failure{
				File:    matches[1],
				Line:    lineNum,
				Type:    "error",
				Message: matches[4],
			}
			
			// Look ahead for more context
			if i+1 < len(lines) {
				nextLine := strings.TrimSpace(lines[i+1])
				if nextLine != "" && !strings.Contains(nextLine, ":") {
					failure.Message += ": " + truncateMessage(nextLine)
				}
			}
			
			result.Failures = append(result.Failures, failure)
		}
	}

	if len(result.Failures) > 0 {
		result.Status = runner.StatusFailure
	}

	return result
}

// parseTypeScriptOutput parses TypeScript compiler errors.
func parseTypeScriptOutput(output string) *runner.Result {
	result := &runner.Result{
		Status:   runner.StatusSuccess,
		Failures: []runner.Failure{},
	}

	lines := strings.Split(output, "\n")
	
	// Patterns for TypeScript errors
	tscErrorPattern := regexp.MustCompile(`^(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)$`)
	tscAltPattern := regexp.MustCompile(`^(.+?):(\d+):(\d+) - error TS(\d+): (.+)$`)
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		
		// Check for TypeScript error pattern (Windows style)
		if matches := tscErrorPattern.FindStringSubmatch(line); len(matches) == 6 {
			lineNum := parseInt(matches[2])
			errorCode := matches[4]
			message := matches[5]
			
			failure := runner.Failure{
				File:    matches[1],
				Line:    lineNum,
				Type:    "error",
				Message: fmt.Sprintf("TS%s: %s", errorCode, message),
			}
			
			result.Failures = append(result.Failures, failure)
		}
		
		// Check for TypeScript error pattern (Unix style)
		if matches := tscAltPattern.FindStringSubmatch(line); len(matches) == 6 {
			lineNum := parseInt(matches[2])
			errorCode := matches[4]
			message := matches[5]
			
			failure := runner.Failure{
				File:    matches[1],
				Line:    lineNum,
				Type:    "error",
				Message: fmt.Sprintf("TS%s: %s", errorCode, message),
			}
			
			result.Failures = append(result.Failures, failure)
		}
	}

	if len(result.Failures) > 0 {
		result.Status = runner.StatusFailure
	}

	return result
}

// parseGenericBuildOutput provides fallback parsing for generic build errors.
func parseGenericBuildOutput(output string) *runner.Result {
	result := &runner.Result{
		Status:   runner.StatusSuccess,
		Failures: []runner.Failure{},
	}

	lines := strings.Split(output, "\n")
	
	// Generic patterns
	genericErrorPattern := regexp.MustCompile(`(?i)error|failed|exception`)
	fileLinePattern := regexp.MustCompile(`(.+?):(\d+):?(\d+)?`)
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		
		// Skip empty lines and common noise
		if line == "" || strings.HasPrefix(line, "npm") || strings.HasPrefix(line, "yarn") {
			continue
		}
		
		// Look for lines that contain error indicators
		if genericErrorPattern.MatchString(line) {
			failure := runner.Failure{
				Type:    "error",
				Message: truncateMessage(line),
			}
			
			// Try to extract file and line number
			if matches := fileLinePattern.FindStringSubmatch(line); len(matches) >= 3 {
				failure.File = matches[1]
				if len(matches) > 2 && matches[2] != "" {
					failure.Line = parseInt(matches[2])
				}
			}
			
			result.Failures = append(result.Failures, failure)
		}
	}

	if len(result.Failures) > 0 {
		result.Status = runner.StatusFailure
	}

	return result
}

// Helper functions

func extractFileName(filePath string) string {
	// Remove webpack loader prefixes (handle multiple loaders)
	loaderPattern := regexp.MustCompile(`^.+!([^!]+)$`)
	if matches := loaderPattern.FindStringSubmatch(filePath); len(matches) > 1 {
		filePath = matches[1]
	}
	
	// Remove line:column information
	linePattern := regexp.MustCompile(`^(.+?):\d+:\d+`)
	if matches := linePattern.FindStringSubmatch(filePath); len(matches) > 1 {
		filePath = matches[1]
	}
	
	// Extract just the file path part (remove query params)
	filePattern := regexp.MustCompile(`^(.+?)(?:\?|$)`)
	if matches := filePattern.FindStringSubmatch(filePath); len(matches) > 1 {
		return matches[1]
	}
	
	return filePath
}

func extractLineNumber(filePath string, errorLines []string) int {
	// First try to extract from file path
	linePattern := regexp.MustCompile(`:(\d+):`)
	if matches := linePattern.FindStringSubmatch(filePath); len(matches) > 1 {
		return parseInt(matches[1])
	}
	
	// Then try to extract from error lines
	for _, line := range errorLines {
		if matches := linePattern.FindStringSubmatch(line); len(matches) > 1 {
			return parseInt(matches[1])
		}
	}
	
	return 0
}

func extractErrorMessage(errorLines []string) string {
	if len(errorLines) == 0 {
		return "Build error"
	}
	
	// Find the most meaningful error line
	for _, line := range errorLines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "at ") && !strings.HasPrefix(line, "    at ") && !strings.Contains(line, "at Object.<anonymous>") {
			return truncateMessage(line)
		}
	}
	
	// Check if all lines are stack traces
	allStackTraces := true
	for _, line := range errorLines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "at ") && !strings.HasPrefix(line, "    at ") && !strings.Contains(line, "at Object.<anonymous>") {
			allStackTraces = false
			break
		}
	}
	
	if allStackTraces {
		return "Build error"
	}
	
	// Fallback to first non-empty line
	for _, line := range errorLines {
		line = strings.TrimSpace(line)
		if line != "" {
			return truncateMessage(line)
		}
	}
	
	return "Build error"
}

func parseInt(s string) int {
	if i, err := strconv.Atoi(s); err == nil {
		return i
	}
	return 0
}