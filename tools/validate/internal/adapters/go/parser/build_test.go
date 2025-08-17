package parser

import (
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestParseGoBuildOutput_Success(t *testing.T) {
	output := ""

	result, err := ParseGoBuildOutput(output)
	if err != nil {
		t.Fatalf("ParseGoBuildOutput failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected 0 failures, got %d", len(result.Failures))
	}
}

func TestParseGoBuildOutput_WithErrors(t *testing.T) {
	output := `# github.com/test/pkg
main.go:15:2: undefined: unknownFunction
main.go:20:5: syntax error: unexpected }
utils.go:10:1: cannot use string as int in assignment`

	result, err := ParseGoBuildOutput(output)
	if err != nil {
		t.Fatalf("ParseGoBuildOutput failed: %v", err)
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
		if !contains(failure.Message, "undefined: unknownFunction") {
			t.Errorf("Expected message to contain 'undefined: unknownFunction', got '%s'", failure.Message)
		}
		if failure.Type != "build" {
			t.Errorf("Expected type 'build', got '%s'", failure.Type)
		}
	}

	// Check second failure
	if len(result.Failures) > 1 {
		failure := result.Failures[1]
		if failure.File != "main.go" {
			t.Errorf("Expected file 'main.go', got '%s'", failure.File)
		}
		if failure.Line != 20 {
			t.Errorf("Expected line 20, got %d", failure.Line)
		}
		if !contains(failure.Message, "syntax error") {
			t.Errorf("Expected message to contain 'syntax error', got '%s'", failure.Message)
		}
	}

	// Check third failure
	if len(result.Failures) > 2 {
		failure := result.Failures[2]
		if failure.File != "utils.go" {
			t.Errorf("Expected file 'utils.go', got '%s'", failure.File)
		}
		if failure.Line != 10 {
			t.Errorf("Expected line 10, got %d", failure.Line)
		}
	}
}

func TestParseGoBuildOutput_WithoutPackageLine(t *testing.T) {
	output := `main.go:15:2: undefined: unknownFunction
utils.go:10:1: cannot use string as int in assignment`

	result, err := ParseGoBuildOutput(output)
	if err != nil {
		t.Fatalf("ParseGoBuildOutput failed: %v", err)
	}

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}
}

func TestParseGoBuildOutput_GenericErrors(t *testing.T) {
	output := `some build error occurred
Another error without .go file reference
main.go: some error here`

	result, err := ParseGoBuildOutput(output)
	if err != nil {
		t.Fatalf("ParseGoBuildOutput failed: %v", err)
	}

	// Should find at least the last line which contains "error" and ".go"
	if len(result.Failures) == 0 {
		t.Error("Expected at least 1 failure")
	}
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
}

func TestParseGoBuildOutput_MixedOutput(t *testing.T) {
	output := `# github.com/test/pkg
go: downloading github.com/some/dep v1.0.0
main.go:15:2: undefined: unknownFunction
go: found github.com/some/dep v1.0.0 in github.com/some/dep v1.0.0
utils.go:10:1: cannot use string as int in assignment`

	result, err := ParseGoBuildOutput(output)
	if err != nil {
		t.Fatalf("ParseGoBuildOutput failed: %v", err)
	}

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	// Should only parse the actual error lines, not the "go:" lines
	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}
}

func TestParseBuildErrors_EmptyOutput(t *testing.T) {
	failures := parseBuildErrors("")
	if len(failures) != 0 {
		t.Errorf("Expected 0 failures, got %d", len(failures))
	}
}

func TestExtractBuildFileFromLine(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		expected string
	}{
		{
			name:     "standard format",
			line:     "main.go:15:2: undefined: unknownFunction",
			expected: "main.go",
		},
		{
			name:     "with path",
			line:     "/path/to/main.go:15:2: error message",
			expected: "/path/to/main.go",
		},
		{
			name:     "file at end",
			line:     "error in main.go",
			expected: "main.go",
		},
		{
			name:     "file with line number attached",
			line:     "error at main.go:15",
			expected: "main.go",
		},
		{
			name:     "no file reference",
			line:     "some error message",
			expected: "",
		},
		{
			name:     "multiple go files",
			line:     "main.go:15: error referencing utils.go",
			expected: "main.go",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := extractBuildFileFromLine(test.line)
			if result != test.expected {
				t.Errorf("Expected '%s', got '%s'", test.expected, result)
			}
		})
	}
}

func TestExtractBuildLineFromLine(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		expected int
	}{
		{
			name:     "standard format",
			line:     "main.go:15:2: undefined: unknownFunction",
			expected: 15,
		},
		{
			name:     "simple format",
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
			line:     "main.go:abc:2: error message",
			expected: 0,
		},
		{
			name:     "file at end with line",
			line:     "error in main.go:42",
			expected: 42,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := extractBuildLineFromLine(test.line)
			if result != test.expected {
				t.Errorf("Expected %d, got %d", test.expected, result)
			}
		})
	}
}
