package runner

import (
	"strings"
	"testing"
	"time"
)

func TestResult_FormatSummary(t *testing.T) {
	tests := []struct {
		name     string
		result   Result
		expected string
	}{
		{
			name: "successful test with coverage",
			result: Result{
				Service:     "agent-service",
				Phase:       PhaseTest,
				Status:      StatusSuccess,
				Duration:    1200 * time.Millisecond,
				PassedCount: 45,
				FailedCount: 0,
				Coverage: &Coverage{
					Percentage: 95.0,
				},
			},
			expected: "✓ agent-service: 45 passed (1.2s) 95% coverage",
		},
		{
			name: "failed test with failures",
			result: Result{
				Service:     "agent-service",
				Phase:       PhaseTest,
				Status:      StatusFailure,
				Duration:    1200 * time.Millisecond,
				PassedCount: 45,
				FailedCount: 2,
				Coverage: &Coverage{
					Percentage: 95.0,
				},
			},
			expected: "✗ agent-service: 45 passed, 2 failed (1.2s) 95% coverage",
		},
		{
			name: "successful lint",
			result: Result{
				Service: "mcp-service",
				Phase:   PhaseLint,
				Status:  StatusSuccess,
			},
			expected: "✓ mcp-service: no issues",
		},
		{
			name: "failed lint with errors and warnings",
			result: Result{
				Service:      "mcp-service",
				Phase:        PhaseLint,
				Status:       StatusFailure,
				FailedCount:  3,
				WarningCount: 6,
			},
			expected: "✗ mcp-service: 3 errors, 6 warnings",
		},
		{
			name: "failed lint with only errors",
			result: Result{
				Service:     "mcp-service",
				Phase:       PhaseLint,
				Status:      StatusFailure,
				FailedCount: 3,
			},
			expected: "✗ mcp-service: 3 errors",
		},
		{
			name: "failed lint with only warnings",
			result: Result{
				Service:      "mcp-service",
				Phase:        PhaseLint,
				Status:       StatusFailure,
				WarningCount: 6,
			},
			expected: "✗ mcp-service: 6 warnings",
		},
		{
			name: "successful build",
			result: Result{
				Service:  "ui",
				Phase:    PhaseBuild,
				Status:   StatusSuccess,
				Duration: 5800 * time.Millisecond,
			},
			expected: "✓ ui: build succeeded (5.8s)",
		},
		{
			name: "failed build",
			result: Result{
				Service:  "ui",
				Phase:    PhaseBuild,
				Status:   StatusFailure,
				Duration: 2300 * time.Millisecond,
			},
			expected: "✗ ui: build failed (2.3s)",
		},
		{
			name: "test without duration",
			result: Result{
				Service:     "test-service",
				Phase:       PhaseTest,
				Status:      StatusSuccess,
				PassedCount: 10,
			},
			expected: "✓ test-service: 10 passed",
		},
		{
			name: "test without coverage",
			result: Result{
				Service:     "test-service",
				Phase:       PhaseTest,
				Status:      StatusSuccess,
				Duration:    500 * time.Millisecond,
				PassedCount: 10,
			},
			expected: "✓ test-service: 10 passed (500ms)",
		},
		{
			name: "unknown phase",
			result: Result{
				Service: "test-service",
				Phase:   Phase("unknown"),
				Status:  StatusSuccess,
			},
			expected: "✓ test-service: unknown phase unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.result.FormatSummary()
			if result != tt.expected {
				t.Errorf("FormatSummary() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{
			name:     "zero duration",
			duration: 0,
			expected: "",
		},
		{
			name:     "sub-millisecond",
			duration: 500 * time.Microsecond,
			expected: "",
		},
		{
			name:     "milliseconds",
			duration: 500 * time.Millisecond,
			expected: "500ms",
		},
		{
			name:     "one second",
			duration: 1 * time.Second,
			expected: "1.0s",
		},
		{
			name:     "seconds with decimal",
			duration: 1500 * time.Millisecond,
			expected: "1.5s",
		},
		{
			name:     "multiple seconds",
			duration: 5800 * time.Millisecond,
			expected: "5.8s",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatDuration(tt.duration)
			if result != tt.expected {
				t.Errorf("formatDuration(%v) = %q, want %q", tt.duration, result, tt.expected)
			}
		})
	}
}

func TestResult_FormatFailures(t *testing.T) {
	tests := []struct {
		name     string
		result   Result
		expected string
	}{
		{
			name:     "no failures",
			result:   Result{},
			expected: "",
		},
		{
			name: "single failure",
			result: Result{
				Failures: []Failure{
					{
						File:    "test.go",
						Line:    42,
						Message: "assertion failed",
						Type:    "test",
					},
				},
			},
			expected: "test.go:42 [test] assertion failed",
		},
		{
			name: "multiple failures sorted",
			result: Result{
				Failures: []Failure{
					{
						File:    "z_test.go",
						Line:    10,
						Message: "test z failed",
					},
					{
						File:    "a_test.go",
						Line:    20,
						Message: "test a failed",
					},
					{
						File:    "a_test.go",
						Line:    10,
						Message: "test a1 failed",
					},
				},
			},
			expected: "a_test.go:10 test a1 failed\na_test.go:20 test a failed\nz_test.go:10 test z failed",
		},
		{
			name: "failure without line number",
			result: Result{
				Failures: []Failure{
					{
						File:    "test.go",
						Message: "general failure",
					},
				},
			},
			expected: "test.go general failure",
		},
		{
			name: "failure without file",
			result: Result{
				Failures: []Failure{
					{
						Message: "general failure",
						Type:    "error",
					},
				},
			},
			expected: "[error] general failure",
		},
		{
			name: "failure with truncated message",
			result: Result{
				Failures: []Failure{
					{
						File:    "test.go",
						Line:    1,
						Message: strings.Repeat("a", 250),
					},
				},
			},
			expected: "test.go:1 " + strings.Repeat("a", 197) + "...",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.result.FormatFailures()
			if result != tt.expected {
				t.Errorf("FormatFailures() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestResult_FormatFailures_Truncation(t *testing.T) {
	// Create more than MaxFailuresDisplayed failures
	failures := []Failure{}
	for i := 0; i < MaxFailuresDisplayed+3; i++ {
		failures = append(failures, Failure{
			File:    "test.go",
			Line:    i + 1,
			Message: "failure message",
		})
	}

	result := Result{Failures: failures}
	formatted := result.FormatFailures()

	lines := strings.Split(formatted, "\n")
	
	// Should have MaxFailuresDisplayed failures + 1 truncation line
	expectedLines := MaxFailuresDisplayed + 1
	if len(lines) != expectedLines {
		t.Errorf("Expected %d lines, got %d", expectedLines, len(lines))
	}

	// Last line should be truncation notice
	lastLine := lines[len(lines)-1]
	expected := "... and 3 more failures"
	if lastLine != expected {
		t.Errorf("Expected truncation line %q, got %q", expected, lastLine)
	}
}

func TestResult_FormatFailures_ExactlyMaxDisplayed(t *testing.T) {
	// Create exactly MaxFailuresDisplayed failures (no truncation)
	failures := []Failure{}
	for i := 0; i < MaxFailuresDisplayed; i++ {
		failures = append(failures, Failure{
			File:    "test.go",
			Line:    i + 1,
			Message: "failure message",
		})
	}

	result := Result{Failures: failures}
	formatted := result.FormatFailures()

	lines := strings.Split(formatted, "\n")
	
	// Should have exactly MaxFailuresDisplayed failures, no truncation line
	if len(lines) != MaxFailuresDisplayed {
		t.Errorf("Expected %d lines, got %d", MaxFailuresDisplayed, len(lines))
	}

	// Should not contain truncation notice
	for _, line := range lines {
		if strings.Contains(line, "... and") {
			t.Errorf("Unexpected truncation notice in output: %q", line)
		}
	}
}

func TestResult_FormatFailures_SortingEdgeCases(t *testing.T) {
	// Test all branches of the sorting comparator
	result := Result{
		Failures: []Failure{
			// Same file, same line, different messages (tests third branch)
			{File: "same.go", Line: 10, Message: "z message"},
			{File: "same.go", Line: 10, Message: "a message"},
			// Same file, different lines (tests second branch)
			{File: "same.go", Line: 5, Message: "different line"},
			// Different files (tests first branch)
			{File: "a.go", Line: 1, Message: "file a"},
		},
	}

	formatted := result.FormatFailures()
	lines := strings.Split(formatted, "\n")

	expected := []string{
		"a.go:1 file a",
		"same.go:5 different line",
		"same.go:10 a message", // sorted by message
		"same.go:10 z message",
	}

	if len(lines) != len(expected) {
		t.Errorf("Expected %d lines, got %d", len(expected), len(lines))
	}

	for i, line := range lines {
		if i < len(expected) && line != expected[i] {
			t.Errorf("Line %d: expected %q, got %q", i, expected[i], line)
		}
	}
}

func TestFormatFailure(t *testing.T) {
	tests := []struct {
		name     string
		failure  Failure
		expected string
	}{
		{
			name: "complete failure",
			failure: Failure{
				File:    "test.go",
				Line:    42,
				Message: "assertion failed",
				Type:    "test",
			},
			expected: "test.go:42 [test] assertion failed",
		},
		{
			name: "failure without line",
			failure: Failure{
				File:    "test.go",
				Message: "general failure",
				Type:    "error",
			},
			expected: "test.go [error] general failure",
		},
		{
			name: "failure without file",
			failure: Failure{
				Message: "general failure",
				Type:    "error",
			},
			expected: "[error] general failure",
		},
		{
			name: "failure without type",
			failure: Failure{
				File:    "test.go",
				Line:    42,
				Message: "assertion failed",
			},
			expected: "test.go:42 assertion failed",
		},
		{
			name: "minimal failure",
			failure: Failure{
				Message: "something went wrong",
			},
			expected: "something went wrong",
		},
		{
			name: "truncated message",
			failure: Failure{
				File:    "test.go",
				Line:    1,
				Message: strings.Repeat("x", MaxFailureMessageLength+10),
			},
			expected: "test.go:1 " + strings.Repeat("x", MaxFailureMessageLength-3) + "...",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatFailure(tt.failure)
			if result != tt.expected {
				t.Errorf("formatFailure() = %q, want %q", result, tt.expected)
			}
		})
	}
}