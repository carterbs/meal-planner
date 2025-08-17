package runner

import (
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var update = flag.Bool("update", false, "update golden files")

func TestFormatSummary_Golden(t *testing.T) {
	tests := []struct {
		name   string
		result Result
	}{
		{
			name: "successful_test_with_coverage",
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
		},
		{
			name: "failed_test_with_failures",
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
		},
		{
			name: "successful_lint",
			result: Result{
				Service: "mcp-service",
				Phase:   PhaseLint,
				Status:  StatusSuccess,
			},
		},
		{
			name: "failed_lint_with_errors_and_warnings",
			result: Result{
				Service:      "mcp-service",
				Phase:        PhaseLint,
				Status:       StatusFailure,
				FailedCount:  3,
				WarningCount: 6,
			},
		},
		{
			name: "successful_build",
			result: Result{
				Service:  "ui",
				Phase:    PhaseBuild,
				Status:   StatusSuccess,
				Duration: 5800 * time.Millisecond,
			},
		},
		{
			name: "failed_build",
			result: Result{
				Service:  "ui",
				Phase:    PhaseBuild,
				Status:   StatusFailure,
				Duration: 2300 * time.Millisecond,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := tt.result.FormatSummary()
			goldenFile := filepath.Join("testdata", "summary_"+tt.name+".golden")

			if *update {
				err := os.WriteFile(goldenFile, []byte(actual), 0644)
				if err != nil {
					t.Fatalf("Failed to update golden file: %v", err)
				}
			}

			expected, err := os.ReadFile(goldenFile)
			if err != nil {
				t.Fatalf("Failed to read golden file %s: %v", goldenFile, err)
			}

			if actual != strings.TrimSpace(string(expected)) {
				t.Errorf("FormatSummary() mismatch:\nActual:   %q\nExpected: %q",
					actual, strings.TrimSpace(string(expected)))
			}
		})
	}
}

func TestFormatFailures_Golden(t *testing.T) {
	tests := []struct {
		name   string
		result Result
	}{
		{
			name: "single_failure",
			result: Result{
				Failures: []Failure{
					{
						File:    "test.go",
						Line:    42,
						Message: "assertion failed: expected 5, got 3",
						Type:    "test",
					},
				},
			},
		},
		{
			name: "multiple_failures_sorted",
			result: Result{
				Failures: []Failure{
					{
						File:    "z_test.go",
						Line:    10,
						Message: "test z failed with error",
						Type:    "test",
					},
					{
						File:    "a_test.go",
						Line:    20,
						Message: "test a failed with timeout",
						Type:    "test",
					},
					{
						File:    "a_test.go",
						Line:    10,
						Message: "test a1 failed with assertion error",
						Type:    "test",
					},
				},
			},
		},
		{
			name: "lint_failures",
			result: Result{
				Phase: PhaseLint,
				Failures: []Failure{
					{
						File:    "src/main.go",
						Line:    15,
						Message: "unused variable 'result'",
						Type:    "lint",
					},
					{
						File:    "src/utils.go",
						Line:    8,
						Message: "line too long (120 > 100 characters)",
						Type:    "style",
					},
				},
			},
		},
		{
			name: "failure_without_location",
			result: Result{
				Failures: []Failure{
					{
						Message: "build process failed: compilation error",
						Type:    "build",
					},
				},
			},
		},
		{
			name: "failure_with_long_message",
			result: Result{
				Failures: []Failure{
					{
						File:    "test.go",
						Line:    1,
						Message: strings.Repeat("This is a very long error message that should be truncated. ", 10),
						Type:    "test",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := tt.result.FormatFailures()
			goldenFile := filepath.Join("testdata", "failures_"+tt.name+".golden")

			if *update {
				err := os.WriteFile(goldenFile, []byte(actual), 0644)
				if err != nil {
					t.Fatalf("Failed to update golden file: %v", err)
				}
			}

			expected, err := os.ReadFile(goldenFile)
			if err != nil {
				t.Fatalf("Failed to read golden file %s: %v", goldenFile, err)
			}

			if actual != strings.TrimSpace(string(expected)) {
				t.Errorf("FormatFailures() mismatch:\nActual:\n%s\nExpected:\n%s",
					actual, strings.TrimSpace(string(expected)))
			}
		})
	}
}

func TestToJSON_Golden(t *testing.T) {
	tests := []struct {
		name   string
		result Result
	}{
		{
			name: "complete_test_result",
			result: Result{
				Service:  "test-service",
				Phase:    PhaseTest,
				Duration: 2*time.Second + 500*time.Millisecond,
				Status:   StatusSuccess,
				Coverage: &Coverage{
					Percentage: 85.5,
					Covered:    171,
					Total:      200,
					Details: map[string]FileCoverage{
						"file1.go": {
							Percentage: 90.0,
							Covered:    90,
							Total:      100,
						},
						"file2.go": {
							Percentage: 80.0,
							Covered:    80,
							Total:      100,
						},
					},
				},
				Failures: []Failure{
					{
						File:    "test.go",
						Line:    42,
						Message: "assertion failed",
						Type:    "test",
					},
				},
				PassedCount:  45,
				FailedCount:  2,
				WarningCount: 1,
				ErrorMessage: "",
			},
		},
		{
			name: "lint_result",
			result: Result{
				Service:      "lint-service",
				Phase:        PhaseLint,
				Duration:     800 * time.Millisecond,
				Status:       StatusFailure,
				FailedCount:  3,
				WarningCount: 6,
				Failures: []Failure{
					{
						File:    "src/main.go",
						Line:    15,
						Message: "unused variable",
						Type:    "lint",
					},
				},
			},
		},
		{
			name: "build_result",
			result: Result{
				Service:      "build-service",
				Phase:        PhaseBuild,
				Duration:     5 * time.Second,
				Status:       StatusSuccess,
				ErrorMessage: "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual, err := tt.result.ToJSON()
			if err != nil {
				t.Fatalf("ToJSON() failed: %v", err)
			}

			goldenFile := filepath.Join("testdata", "json_"+tt.name+".golden")

			if *update {
				err := os.WriteFile(goldenFile, []byte(actual), 0644)
				if err != nil {
					t.Fatalf("Failed to update golden file: %v", err)
				}
			}

			expected, err := os.ReadFile(goldenFile)
			if err != nil {
				t.Fatalf("Failed to read golden file %s: %v", goldenFile, err)
			}

			if actual != strings.TrimSpace(string(expected)) {
				t.Errorf("ToJSON() mismatch:\nActual:\n%s\nExpected:\n%s",
					actual, strings.TrimSpace(string(expected)))
			}
		})
	}
}
