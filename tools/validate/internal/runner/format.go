package runner

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

const (
	// MaxFailureMessageLength is the maximum length for failure messages before truncation
	MaxFailureMessageLength = 200
	// MaxFailuresDisplayed is the maximum number of failures to display
	MaxFailuresDisplayed = 5
)

// FormatSummary returns a deterministic quiet mode summary for the result.
func (r Result) FormatSummary() string {
	symbol := "✓"
	if r.Status != StatusSuccess {
		symbol = "✗"
	}

	switch r.Phase {
	case PhaseTest:
		return r.formatTestSummary(symbol)
	case PhaseLint:
		return r.formatLintSummary(symbol)
	case PhaseBuild:
		return r.formatBuildSummary(symbol)
	default:
		return fmt.Sprintf("%s %s: unknown phase %s", symbol, r.Service, r.Phase)
	}
}

// formatTestSummary formats the summary for test results.
func (r Result) formatTestSummary(symbol string) string {
	parts := []string{fmt.Sprintf("%s %s:", symbol, r.Service)}

	// Add pass/fail counts
	if r.PassedCount > 0 || r.FailedCount > 0 {
		if r.FailedCount == 0 {
			parts = append(parts, fmt.Sprintf("%d passed", r.PassedCount))
		} else {
			parts = append(parts, fmt.Sprintf("%d passed, %d failed", r.PassedCount, r.FailedCount))
		}
	}

	// Add duration
	duration := formatDuration(r.Duration)
	if duration != "" {
		parts = append(parts, fmt.Sprintf("(%s)", duration))
	}

	// Add coverage if available
	if r.Coverage != nil {
		parts = append(parts, fmt.Sprintf("%.0f%% coverage", r.Coverage.Percentage))
	}

	return strings.Join(parts, " ")
}

// formatLintSummary formats the summary for lint results.
func (r Result) formatLintSummary(symbol string) string {
	parts := []string{fmt.Sprintf("%s %s:", symbol, r.Service)}

	if r.Status == StatusSuccess {
		parts = append(parts, "no issues")
	} else {
		issueParts := []string{}
		if r.FailedCount > 0 {
			issueParts = append(issueParts, fmt.Sprintf("%d errors", r.FailedCount))
		}
		if r.WarningCount > 0 {
			issueParts = append(issueParts, fmt.Sprintf("%d warnings", r.WarningCount))
		}
		if len(issueParts) > 0 {
			parts = append(parts, strings.Join(issueParts, ", "))
		}
	}

	return strings.Join(parts, " ")
}

// formatBuildSummary formats the summary for build results.
func (r Result) formatBuildSummary(symbol string) string {
	parts := []string{fmt.Sprintf("%s %s:", symbol, r.Service)}

	if r.Status == StatusSuccess {
		parts = append(parts, "build succeeded")
	} else {
		parts = append(parts, "build failed")
	}

	// Add duration
	duration := formatDuration(r.Duration)
	if duration != "" {
		parts = append(parts, fmt.Sprintf("(%s)", duration))
	}

	return strings.Join(parts, " ")
}

// formatDuration formats a duration in a human-readable format.
func formatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return ""
	}
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	return fmt.Sprintf("%.1fs", d.Seconds())
}

// FormatFailures returns a formatted string of failures with truncation applied.
func (r Result) FormatFailures() string {
	if len(r.Failures) == 0 {
		return ""
	}

	var lines []string

	// Sort failures for deterministic output
	failures := make([]Failure, len(r.Failures))
	copy(failures, r.Failures)
	sort.Slice(failures, func(i, j int) bool {
		if failures[i].File != failures[j].File {
			return failures[i].File < failures[j].File
		}
		if failures[i].Line != failures[j].Line {
			return failures[i].Line < failures[j].Line
		}
		return failures[i].Message < failures[j].Message
	})

	// Display up to MaxFailuresDisplayed failures
	displayCount := len(failures)
	if displayCount > MaxFailuresDisplayed {
		displayCount = MaxFailuresDisplayed
	}

	for i := 0; i < displayCount; i++ {
		failure := failures[i]
		line := formatFailure(failure)
		lines = append(lines, line)
	}

	// Add truncation notice if there are more failures
	if len(failures) > MaxFailuresDisplayed {
		remaining := len(failures) - MaxFailuresDisplayed
		lines = append(lines, fmt.Sprintf("... and %d more failures", remaining))
	}

	return strings.Join(lines, "\n")
}

// formatFailure formats a single failure with truncation.
func formatFailure(f Failure) string {
	parts := []string{}

	// Add file and line if available
	if f.File != "" {
		if f.Line > 0 {
			parts = append(parts, fmt.Sprintf("%s:%d", f.File, f.Line))
		} else {
			parts = append(parts, f.File)
		}
	}

	// Add type if available
	if f.Type != "" {
		parts = append(parts, fmt.Sprintf("[%s]", f.Type))
	}

	// Add message with truncation
	message := f.Message
	if len(message) > MaxFailureMessageLength {
		message = message[:MaxFailureMessageLength-3] + "..."
	}
	parts = append(parts, message)

	return strings.Join(parts, " ")
}

// IsSuccess returns true if the result represents a successful operation.
func (r Result) IsSuccess() bool {
	return r.Status == StatusSuccess
}

// HasFailures returns true if the result has any failures.
func (r Result) HasFailures() bool {
	return len(r.Failures) > 0
}

// TotalTests returns the total number of tests (passed + failed).
func (r Result) TotalTests() int {
	return r.PassedCount + r.FailedCount
}

// FormatSummary returns a formatted summary line for a result.
func FormatSummary(r Result) string {
	return r.FormatSummary()
}

// FormatFailures returns a formatted string of failures for a result.
func FormatFailures(r Result) string {
	return r.FormatFailures()
}
