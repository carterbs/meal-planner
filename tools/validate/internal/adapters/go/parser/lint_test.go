package parser

import (
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestParseGolangciLintJSON_Success(t *testing.T) {
	output := `{"Issues":[]}`

	result, err := ParseGolangciLintJSON(output)
	if err != nil {
		t.Fatalf("ParseGolangciLintJSON failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.WarningCount != 0 {
		t.Errorf("Expected WarningCount 0, got %d", result.WarningCount)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected 0 failures, got %d", len(result.Failures))
	}
}

func TestParseGolangciLintJSON_WithIssues(t *testing.T) {
	output := `{
		"Issues": [
			{
				"FromLinter": "deadcode",
				"Text": "function 'unused' is never used",
				"Severity": "warning",
				"Pos": {
					"Filename": "main.go",
					"Line": 15,
					"Column": 1
				}
			},
			{
				"FromLinter": "errcheck",
				"Text": "Error return value of 'fmt.Println' is not checked",
				"Severity": "error",
				"Pos": {
					"Filename": "main.go",
					"Line": 20,
					"Column": 5
				}
			},
			{
				"FromLinter": "govet",
				"Text": "unreachable code",
				"Severity": "unknown",
				"Pos": {
					"Filename": "utils.go",
					"Line": 25,
					"Column": 1
				}
			}
		]
	}`

	result, err := ParseGolangciLintJSON(output)
	if err != nil {
		t.Fatalf("ParseGolangciLintJSON failed: %v", err)
	}

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if result.WarningCount != 1 {
		t.Errorf("Expected WarningCount 1, got %d", result.WarningCount)
	}
	if len(result.Failures) != 3 {
		t.Errorf("Expected 3 failures, got %d", len(result.Failures))
	}

	// Check warning
	foundWarning := false
	foundError := false
	foundUnknown := false

	for _, failure := range result.Failures {
		if contains(failure.Message, "deadcode") && failure.Type == "warning" {
			foundWarning = true
			if failure.File != "main.go" {
				t.Errorf("Expected warning file 'main.go', got '%s'", failure.File)
			}
			if failure.Line != 15 {
				t.Errorf("Expected warning line 15, got %d", failure.Line)
			}
		}

		if contains(failure.Message, "errcheck") && failure.Type == "error" {
			foundError = true
			if failure.Line != 20 {
				t.Errorf("Expected error line 20, got %d", failure.Line)
			}
		}

		// Unknown severity should default to error
		if contains(failure.Message, "govet") && failure.Type == "error" {
			foundUnknown = true
		}
	}

	if !foundWarning {
		t.Error("Expected to find warning failure")
	}
	if !foundError {
		t.Error("Expected to find error failure")
	}
	if !foundUnknown {
		t.Error("Expected unknown severity to be treated as error")
	}
}

func TestParseGolangciLintJSON_EmptyOutput(t *testing.T) {
	result, err := ParseGolangciLintJSON("")
	if err != nil {
		t.Fatalf("ParseGolangciLintJSON failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.WarningCount != 0 {
		t.Errorf("Expected WarningCount 0, got %d", result.WarningCount)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected 0 failures, got %d", len(result.Failures))
	}
}

func TestParseGolangciLintJSON_InvalidJSON(t *testing.T) {
	output := `{"Issues": invalid json`

	_, err := ParseGolangciLintJSON(output)
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

func TestParseGolangciLintText_Success(t *testing.T) {
	output := `main.go:15:1: function 'unused' is never used (deadcode)
main.go:20:5: Error return value of 'fmt.Println' is not checked (errcheck)
utils.go:25: unreachable code (govet)`

	result, err := ParseGolangciLintText(output)
	if err != nil {
		t.Fatalf("ParseGolangciLintText failed: %v", err)
	}

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 3 {
		t.Errorf("Expected 3 failures, got %d", len(result.Failures))
	}

	// Check first failure
	if len(result.Failures) > 0 {
		failure := result.Failures[0]
		if failure.File != "main.go" {
			t.Errorf("Expected file 'main.go', got '%s'", failure.File)
		}
		if failure.Line != 15 {
			t.Errorf("Expected line 15, got %d", failure.Line)
		}
		if !contains(failure.Message, "deadcode") {
			t.Errorf("Expected message to contain 'deadcode', got '%s'", failure.Message)
		}
		if failure.Type != "error" {
			t.Errorf("Expected type 'error', got '%s'", failure.Type)
		}
	}

	// Check third failure (without column)
	if len(result.Failures) > 2 {
		failure := result.Failures[2]
		if failure.File != "utils.go" {
			t.Errorf("Expected file 'utils.go', got '%s'", failure.File)
		}
		if failure.Line != 25 {
			t.Errorf("Expected line 25, got %d", failure.Line)
		}
	}
}

func TestParseGolangciLintText_EmptyOutput(t *testing.T) {
	result, err := ParseGolangciLintText("")
	if err != nil {
		t.Fatalf("ParseGolangciLintText failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected 0 failures, got %d", len(result.Failures))
	}
}

func TestParseGolangciLintText_GenericErrors(t *testing.T) {
	output := `main.go:15: some error message
level=error msg="golangci-lint failed"`

	result, err := ParseGolangciLintText(output)
	if err != nil {
		t.Fatalf("ParseGolangciLintText failed: %v", err)
	}

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	// Should find at least the first line as an error
	if len(result.Failures) == 0 {
		t.Error("Expected at least 1 failure")
	}
}

func TestExtractFileFromText(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		expected string
	}{
		{
			name:     "standard format",
			line:     "main.go:15:1: error message",
			expected: "main.go",
		},
		{
			name:     "without column",
			line:     "main.go:15: error message",
			expected: "main.go",
		},
		{
			name:     "with path",
			line:     "/path/to/main.go:15:1: error message",
			expected: "/path/to/main.go",
		},
		{
			name:     "no file reference",
			line:     "some error message",
			expected: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := extractFileFromText(test.line)
			if result != test.expected {
				t.Errorf("Expected '%s', got '%s'", test.expected, result)
			}
		})
	}
}

func TestExtractLineFromText(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		expected int
	}{
		{
			name:     "standard format",
			line:     "main.go:15:1: error message",
			expected: 15,
		},
		{
			name:     "without column",
			line:     "main.go:25: error message",
			expected: 25,
		},
		{
			name:     "no line reference",
			line:     "some error message",
			expected: 0,
		},
		{
			name:     "invalid line number",
			line:     "main.go:abc:1: error message",
			expected: 0,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := extractLineFromText(test.line)
			if result != test.expected {
				t.Errorf("Expected %d, got %d", test.expected, result)
			}
		})
	}
}
