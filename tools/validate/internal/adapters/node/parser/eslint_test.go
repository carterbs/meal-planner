package parser

import (
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestParseESLintJSON_Success(t *testing.T) {
	jsonOutput := `[
  {
    "filePath": "src/components/Button.js",
    "messages": [],
    "errorCount": 0,
    "warningCount": 0,
    "fixableErrorCount": 0,
    "fixableWarningCount": 0
  }
]`

	result, err := ParseESLintJSON(jsonOutput)
	if err != nil {
		t.Fatalf("ParseESLintJSON failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
	if result.WarningCount != 0 {
		t.Errorf("Expected WarningCount 0, got %d", result.WarningCount)
	}
}

func TestParseESLintJSON_WithErrors(t *testing.T) {
	jsonOutput := `[
  {
    "filePath": "src/components/Button.js",
    "messages": [
      {
        "ruleId": "no-unused-vars",
        "severity": 2,
        "message": "'unused' is defined but never used",
        "line": 10,
        "column": 25,
        "nodeType": "Identifier",
        "endLine": 10,
        "endColumn": 31
      },
      {
        "ruleId": "@typescript-eslint/explicit-function-return-type",
        "severity": 1,
        "message": "Missing return type annotation",
        "line": 15,
        "column": 10,
        "nodeType": "FunctionDeclaration"
      }
    ],
    "errorCount": 1,
    "warningCount": 1,
    "fixableErrorCount": 0,
    "fixableWarningCount": 0
  }
]`

	result, err := ParseESLintJSON(jsonOutput)
	if err != nil {
		t.Fatalf("ParseESLintJSON failed: %v", err)
	}

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}
	if result.WarningCount != 1 {
		t.Errorf("Expected WarningCount 1, got %d", result.WarningCount)
	}

	// Check error failure
	errorFailure := result.Failures[0]
	if errorFailure.File != "src/components/Button.js" {
		t.Errorf("Expected file 'src/components/Button.js', got '%s'", errorFailure.File)
	}
	if errorFailure.Line != 10 {
		t.Errorf("Expected line 10, got %d", errorFailure.Line)
	}
	if errorFailure.Type != "error" {
		t.Errorf("Expected type 'error', got '%s'", errorFailure.Type)
	}
	if errorFailure.Message != "'unused' is defined but never used (no-unused-vars)" {
		t.Errorf("Expected formatted message, got '%s'", errorFailure.Message)
	}

	// Check warning failure
	warningFailure := result.Failures[1]
	if warningFailure.Type != "warning" {
		t.Errorf("Expected type 'warning', got '%s'", warningFailure.Type)
	}
	if warningFailure.Line != 15 {
		t.Errorf("Expected line 15, got %d", warningFailure.Line)
	}
}

func TestParseESLintJSON_Empty(t *testing.T) {
	result, err := ParseESLintJSON("")
	if err != nil {
		t.Fatalf("ParseESLintJSON failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}

func TestParseESLintJSON_InvalidJSON(t *testing.T) {
	_, err := ParseESLintJSON("invalid json")
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

func TestParseESLintTextOutput_Success(t *testing.T) {
	textOutput := ""

	result := ParseESLintTextOutput(textOutput)

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}

func TestParseESLintTextOutput_WithErrors(t *testing.T) {
	textOutput := `src/components/Button.js
  10:25  error    'unused' is defined but never used  no-unused-vars
  15:10  warning  Missing return type annotation      @typescript-eslint/explicit-function-return-type

✖ 2 problems (1 error, 1 warning)`

	result := ParseESLintTextOutput(textOutput)

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}
	if result.WarningCount != 1 {
		t.Errorf("Expected WarningCount 1, got %d", result.WarningCount)
	}

	// Check first failure (error)
	errorFailure := result.Failures[0]
	if errorFailure.Line != 10 {
		t.Errorf("Expected line 10, got %d", errorFailure.Line)
	}
	if errorFailure.Type != "error" {
		t.Errorf("Expected type 'error', got '%s'", errorFailure.Type)
	}

	// Check second failure (warning)
	warningFailure := result.Failures[1]
	if warningFailure.Line != 15 {
		t.Errorf("Expected line 15, got %d", warningFailure.Line)
	}
	if warningFailure.Type != "warning" {
		t.Errorf("Expected type 'warning', got '%s'", warningFailure.Type)
	}
}

func TestParseESLintTextOutput_AlternativeFormat(t *testing.T) {
	textOutput := `src/components/Button.js:10:25: error: 'unused' is defined but never used
src/components/Header.js:5:12: warning: Missing semicolon`

	result := ParseESLintTextOutput(textOutput)

	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}

	// Check first failure
	errorFailure := result.Failures[0]
	if errorFailure.File != "src/components/Button.js" {
		t.Errorf("Expected file 'src/components/Button.js', got '%s'", errorFailure.File)
	}
	if errorFailure.Line != 10 {
		t.Errorf("Expected line 10, got %d", errorFailure.Line)
	}
	if errorFailure.Type != "error" {
		t.Errorf("Expected type 'error', got '%s'", errorFailure.Type)
	}

	// Check second failure
	warningFailure := result.Failures[1]
	if warningFailure.File != "src/components/Header.js" {
		t.Errorf("Expected file 'src/components/Header.js', got '%s'", warningFailure.File)
	}
	if warningFailure.Line != 5 {
		t.Errorf("Expected line 5, got %d", warningFailure.Line)
	}
	if warningFailure.Type != "warning" {
		t.Errorf("Expected type 'warning', got '%s'", warningFailure.Type)
	}
}

func TestParseESLintTextOutput_NoProblems(t *testing.T) {
	textOutput := `src/components/Button.js

✓ 0 problems`

	result := ParseESLintTextOutput(textOutput)

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}

func TestFormatESLintMessage(t *testing.T) {
	tests := []struct {
		name     string
		message  ESLintMessage
		expected string
	}{
		{
			name: "message with rule",
			message: ESLintMessage{
				Message: "'unused' is defined but never used",
				RuleId:  "no-unused-vars",
			},
			expected: "'unused' is defined but never used (no-unused-vars)",
		},
		{
			name: "message without rule",
			message: ESLintMessage{
				Message: "Parsing error",
				RuleId:  "",
			},
			expected: "Parsing error",
		},
		{
			name: "empty message",
			message: ESLintMessage{
				Message: "",
				RuleId:  "some-rule",
			},
			expected: " (some-rule)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatESLintMessage(tt.message)
			if result != tt.expected {
				t.Errorf("formatESLintMessage() = %q, want %q", result, tt.expected)
			}
		})
	}
}