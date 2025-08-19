package parser

import (
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestParseGoTestJSON_Success(t *testing.T) {
	output := `{"Time":"2024-01-01T10:00:00Z","Action":"run","Package":"github.com/test/pkg","Test":"TestExample"}
{"Time":"2024-01-01T10:00:01Z","Action":"output","Package":"github.com/test/pkg","Test":"TestExample","Output":"=== RUN   TestExample\n"}
{"Time":"2024-01-01T10:00:02Z","Action":"pass","Package":"github.com/test/pkg","Test":"TestExample","Elapsed":1.0}
{"Time":"2024-01-01T10:00:03Z","Action":"output","Package":"github.com/test/pkg","Output":"coverage: 85.7% of statements\n"}
{"Time":"2024-01-01T10:00:04Z","Action":"pass","Package":"github.com/test/pkg","Elapsed":2.0}`

	result, err := ParseGoTestJSON(output)
	if err != nil {
		t.Fatalf("ParseGoTestJSON failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.PassedCount != 1 {
		t.Errorf("Expected PassedCount 1, got %d", result.PassedCount)
	}
	if result.FailedCount != 0 {
		t.Errorf("Expected FailedCount 0, got %d", result.FailedCount)
	}
	if result.Coverage == nil {
		t.Error("Expected coverage to be set")
	} else if result.Coverage.Percentage != 85.7 {
		t.Errorf("Expected coverage 85.7%%, got %.1f%%", result.Coverage.Percentage)
	}
}

func TestParseGoTestJSON_Failure(t *testing.T) {
	output := `{"Time":"2024-01-01T10:00:00Z","Action":"run","Package":"github.com/test/pkg","Test":"TestExample"}
{"Time":"2024-01-01T10:00:01Z","Action":"output","Package":"github.com/test/pkg","Test":"TestExample","Output":"=== RUN   TestExample\n"}
{"Time":"2024-01-01T10:00:02Z","Action":"output","Package":"github.com/test/pkg","Test":"TestExample","Output":"    main_test.go:10: assertion failed\n"}
{"Time":"2024-01-01T10:00:03Z","Action":"fail","Package":"github.com/test/pkg","Test":"TestExample","Elapsed":1.0}
{"Time":"2024-01-01T10:00:04Z","Action":"fail","Package":"github.com/test/pkg","Elapsed":2.0}`

	result, err := ParseGoTestJSON(output)
	if err != nil {
		t.Fatalf("ParseGoTestJSON failed: %v", err)
	}

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if result.PassedCount != 0 {
		t.Errorf("Expected PassedCount 0, got %d", result.PassedCount)
	}
	if result.FailedCount != 1 {
		t.Errorf("Expected FailedCount 1, got %d", result.FailedCount)
	}
	if len(result.Failures) != 1 {
		t.Errorf("Expected 1 failure, got %d", len(result.Failures))
	}

	if len(result.Failures) > 0 {
		failure := result.Failures[0]
		if failure.Type != "test" {
			t.Errorf("Expected failure type 'test', got '%s'", failure.Type)
		}
		if failure.File != "main_test.go" {
			t.Errorf("Expected failure file 'main_test.go', got '%s'", failure.File)
		}
		if failure.Line != 10 {
			t.Errorf("Expected failure line 10, got %d", failure.Line)
		}
		if !contains(failure.Message, "assertion failed") {
			t.Errorf("Expected failure message to contain 'assertion failed', got '%s'", failure.Message)
		}
	}
}

func TestParseGoTestJSON_EmptyOutput(t *testing.T) {
	result, err := ParseGoTestJSON("")
	if err != nil {
		t.Fatalf("ParseGoTestJSON failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.PassedCount != 0 {
		t.Errorf("Expected PassedCount 0, got %d", result.PassedCount)
	}
	if result.FailedCount != 0 {
		t.Errorf("Expected FailedCount 0, got %d", result.FailedCount)
	}
}

func TestParseGoTestJSON_MalformedJSON(t *testing.T) {
	output := `{"Time":"2024-01-01T10:00:00Z","Action":"run","Package":"github.com/test/pkg","Test":"TestExample"}
{"invalid json line
{"Time":"2024-01-01T10:00:02Z","Action":"pass","Package":"github.com/test/pkg","Test":"TestExample","Elapsed":1.0}`

	result, err := ParseGoTestJSON(output)
	if err != nil {
		t.Fatalf("ParseGoTestJSON failed: %v", err)
	}

	// Should skip malformed lines and parse valid ones
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.PassedCount != 1 {
		t.Errorf("Expected PassedCount 1, got %d", result.PassedCount)
	}
}

func TestParseGoTestJSON_SkippedTests(t *testing.T) {
	output := `{"Time":"2024-01-01T10:00:00Z","Action":"run","Package":"github.com/test/pkg","Test":"TestExample"}
{"Time":"2024-01-01T10:00:01Z","Action":"skip","Package":"github.com/test/pkg","Test":"TestExample","Elapsed":0.001}
{"Time":"2024-01-01T10:00:02Z","Action":"pass","Package":"github.com/test/pkg","Elapsed":1.0}`

	result, err := ParseGoTestJSON(output)
	if err != nil {
		t.Fatalf("ParseGoTestJSON failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	// Skipped tests are treated as passed for counting purposes
	if result.PassedCount != 1 {
		t.Errorf("Expected PassedCount 1, got %d", result.PassedCount)
	}
	if result.FailedCount != 0 {
		t.Errorf("Expected FailedCount 0, got %d", result.FailedCount)
	}
}

func TestExtractFileFromOutput(t *testing.T) {
	tests := []struct {
		name     string
		outputs  []string
		expected string
	}{
		{
			name:     "simple file reference",
			outputs:  []string{"    main_test.go:10: assertion failed"},
			expected: "main_test.go",
		},
		{
			name:     "tabbed file reference",
			outputs:  []string{"\tmain_test.go:15: error message"},
			expected: "main_test.go",
		},
		{
			name:     "no file reference",
			outputs:  []string{"some error message"},
			expected: "",
		},
		{
			name:     "multiple lines, first has file",
			outputs:  []string{"    main_test.go:10: assertion failed", "more details"},
			expected: "main_test.go",
		},
		{
			name:     "go command reference (should be ignored)",
			outputs:  []string{"go:build comment ignored", "    real_file.go:5: error"},
			expected: "real_file.go",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := extractFileFromOutput(test.outputs)
			if result != test.expected {
				t.Errorf("Expected '%s', got '%s'", test.expected, result)
			}
		})
	}
}

func TestExtractLineFromOutput(t *testing.T) {
	tests := []struct {
		name     string
		outputs  []string
		expected int
	}{
		{
			name:     "simple line reference",
			outputs:  []string{"    main_test.go:10: assertion failed"},
			expected: 10,
		},
		{
			name:     "with colon after line number",
			outputs:  []string{"    main_test.go:15: error message"},
			expected: 15,
		},
		{
			name:     "no line reference",
			outputs:  []string{"some error message"},
			expected: 0,
		},
		{
			name:     "invalid line number",
			outputs:  []string{"    main_test.go:abc: error"},
			expected: 0,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := extractLineFromOutput(test.outputs)
			if result != test.expected {
				t.Errorf("Expected %d, got %d", test.expected, result)
			}
		})
	}
}

func TestParseCoverageFromOutput(t *testing.T) {
	tests := []struct {
		name               string
		output             string
		expectedPercentage float64
		expectNil          bool
	}{
		{
			name:               "valid coverage",
			output:             "coverage: 85.7% of statements\n",
			expectedPercentage: 85.7,
			expectNil:          false,
		},
		{
			name:               "coverage with other text",
			output:             "=== RUN TestExample\ncoverage: 92.3% of statements\n--- PASS",
			expectedPercentage: 92.3,
			expectNil:          false,
		},
		{
			name:      "no coverage",
			output:    "=== RUN TestExample\n--- PASS",
			expectNil: true,
		},
		{
			name:      "invalid coverage format",
			output:    "coverage: invalid% of statements\n",
			expectNil: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := parseCoverageFromOutput(test.output)
			if test.expectNil {
				if result != nil {
					t.Errorf("Expected nil, got %+v", result)
				}
			} else {
				if result == nil {
					t.Error("Expected coverage result, got nil")
				} else if result.Percentage != test.expectedPercentage {
					t.Errorf("Expected percentage %.1f, got %.1f", test.expectedPercentage, result.Percentage)
				}
			}
		})
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(substr) == 0 || len(s) >= len(substr) && (s == substr ||
		func() bool {
			for i := 0; i <= len(s)-len(substr); i++ {
				if s[i:i+len(substr)] == substr {
					return true
				}
			}
			return false
		}())
}
