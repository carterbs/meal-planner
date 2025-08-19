package parser

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestParseJestJSON_Success(t *testing.T) {
	jsonOutput := `{
  "numTotalTestSuites": 2,
  "numPassedTestSuites": 2,
  "numFailedTestSuites": 0,
  "numTotalTests": 5,
  "numPassedTests": 5,
  "numFailedTests": 0,
  "success": true,
  "testResults": [
    {
      "assertionResults": [
        {
          "ancestorTitles": ["Button"],
          "fullName": "Button should render correctly",
          "status": "passed",
          "title": "should render correctly",
          "duration": 23
        },
        {
          "ancestorTitles": ["Button"],
          "fullName": "Button should handle click",
          "status": "passed",
          "title": "should handle click",
          "duration": 5
        }
      ],
      "name": "src/components/Button.test.js",
      "status": "passed"
    }
  ]
}`

	result, err := ParseJestJSON(jsonOutput)
	if err != nil {
		t.Fatalf("ParseJestJSON failed: %v", err)
	}

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.PassedCount != 5 {
		t.Errorf("Expected PassedCount 5, got %d", result.PassedCount)
	}
	if result.FailedCount != 0 {
		t.Errorf("Expected FailedCount 0, got %d", result.FailedCount)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}

func TestParseJestJSON_WithFailures(t *testing.T) {
	jsonOutput := `{
  "numTotalTestSuites": 1,
  "numPassedTestSuites": 0,
  "numFailedTestSuites": 1,
  "numTotalTests": 2,
  "numPassedTests": 1,
  "numFailedTests": 1,
  "success": false,
  "testResults": [
    {
      "assertionResults": [
        {
          "ancestorTitles": ["Button"],
          "fullName": "Button should render correctly",
          "status": "passed",
          "title": "should render correctly",
          "duration": 23
        },
        {
          "ancestorTitles": ["Button"],
          "fullName": "Button should handle click",
          "status": "failed",
          "title": "should handle click",
          "duration": 5,
          "failureMessages": [
            "expect(received).toBe(expected) // Object.is equality\n\nExpected: true\nReceived: false\n\n    at Object.<anonymous> (src/components/Button.test.js:25:23)"
          ],
          "location": {
            "line": 25,
            "column": 23
          }
        }
      ],
      "name": "src/components/Button.test.js",
      "status": "failed"
    }
  ]
}`

	result, err := ParseJestJSON(jsonOutput)
	if err != nil {
		t.Fatalf("ParseJestJSON failed: %v", err)
	}

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if result.PassedCount != 1 {
		t.Errorf("Expected PassedCount 1, got %d", result.PassedCount)
	}
	if result.FailedCount != 1 {
		t.Errorf("Expected FailedCount 1, got %d", result.FailedCount)
	}
	if len(result.Failures) != 1 {
		t.Errorf("Expected 1 failure, got %d", len(result.Failures))
	}

	failure := result.Failures[0]
	if failure.File != "src/components/Button.test.js" {
		t.Errorf("Expected file 'src/components/Button.test.js', got '%s'", failure.File)
	}
	if failure.Line != 25 {
		t.Errorf("Expected line 25, got %d", failure.Line)
	}
	if failure.Type != "test" {
		t.Errorf("Expected type 'test', got '%s'", failure.Type)
	}
}

func TestParseJestJSON_Empty(t *testing.T) {
	result, err := ParseJestJSON("")
	if err != nil {
		t.Fatalf("ParseJestJSON failed: %v", err)
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

func TestParseJestJSON_InvalidJSON(t *testing.T) {
	_, err := ParseJestJSON("invalid json")
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

func TestParseJestCoverage(t *testing.T) {
	// Create a temporary coverage file
	tempDir, err := os.MkdirTemp("", "jest-coverage-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	coverageData := `{
  "total": {
    "lines": {"total": 100, "covered": 85, "skipped": 0, "pct": 85},
    "functions": {"total": 20, "covered": 18, "skipped": 0, "pct": 90},
    "statements": {"total": 95, "covered": 80, "skipped": 0, "pct": 84.21},
    "branches": {"total": 30, "covered": 25, "skipped": 0, "pct": 83.33}
  },
  "src/components/Button.js": {
    "lines": {"total": 50, "covered": 45, "skipped": 0, "pct": 90},
    "functions": {"total": 10, "covered": 9, "skipped": 0, "pct": 90},
    "statements": {"total": 48, "covered": 43, "skipped": 0, "pct": 89.58},
    "branches": {"total": 15, "covered": 13, "skipped": 0, "pct": 86.67}
  }
}`

	coverageFile := filepath.Join(tempDir, "coverage-summary.json")
	err = os.WriteFile(coverageFile, []byte(coverageData), 0644)
	if err != nil {
		t.Fatal(err)
	}

	coverage, err := ParseJestCoverage(coverageFile)
	if err != nil {
		t.Fatalf("ParseJestCoverage failed: %v", err)
	}

	if coverage.Percentage != 84.21 {
		t.Errorf("Expected percentage 84.21, got %f", coverage.Percentage)
	}
	if coverage.Covered != 80 {
		t.Errorf("Expected covered 80, got %d", coverage.Covered)
	}
	if coverage.Total != 95 {
		t.Errorf("Expected total 95, got %d", coverage.Total)
	}

	// Check file-level coverage
	if len(coverage.Details) != 1 {
		t.Errorf("Expected 1 file in details, got %d", len(coverage.Details))
	}

	buttonCoverage, exists := coverage.Details["src/components/Button.js"]
	if !exists {
		t.Error("Expected Button.js in coverage details")
	}
	if buttonCoverage.Percentage != 89.58 {
		t.Errorf("Expected Button.js percentage 89.58, got %f", buttonCoverage.Percentage)
	}
}

func TestParseJestTextOutput_Success(t *testing.T) {
	textOutput := `PASS src/components/Button.test.js
  Button
    ✓ should render correctly (23ms)
    ✓ should handle click (5ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.234 s
Ran all test suites.`

	result := ParseJestTextOutput(textOutput)

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.PassedCount != 2 {
		t.Errorf("Expected PassedCount 2, got %d", result.PassedCount)
	}
	if result.FailedCount != 0 {
		t.Errorf("Expected FailedCount 0, got %d", result.FailedCount)
	}
}

func TestParseJestTextOutput_WithFailures(t *testing.T) {
	textOutput := `FAIL src/components/Button.test.js
  Button
    ✓ should render correctly (23ms)
    ✕ should handle click (5ms)

      expect(received).toBe(expected) // Object.is equality

      Expected: true
      Received: false

        at Object.<anonymous> (src/components/Button.test.js:25:23)

Tests: 1 failed, 1 passed, 2 total
Snapshots:   0 total
Time:        1.234 s`

	result := ParseJestTextOutput(textOutput)

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if result.PassedCount != 1 {
		t.Errorf("Expected PassedCount 1, got %d", result.PassedCount)
	}
	if result.FailedCount != 1 {
		t.Errorf("Expected FailedCount 1, got %d", result.FailedCount)
	}
	if len(result.Failures) == 0 {
		t.Error("Expected failures to be populated")
	}
}

func TestParseJestTextOutput_WithCoverage(t *testing.T) {
	textOutput := `PASS src/components/Button.test.js
  Button
    ✓ should render correctly (23ms)

------------|---------|----------|---------|---------|-------------------
File        | % Stmts  | % Branch | % Funcs | % Lines | Uncovered Line #s 
------------|---------|----------|---------|---------|-------------------
All files   |   85.5   |   80.25  |   90.5  |   85.5  |                   
------------|---------|----------|---------|---------|-------------------

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total`

	result := ParseJestTextOutput(textOutput)

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.Coverage == nil {
		t.Error("Expected coverage to be populated")
	} else if result.Coverage.Percentage != 85.5 {
		t.Errorf("Expected coverage percentage 85.5, got %f", result.Coverage.Percentage)
	}
}

func TestExtractFailureMessage(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple message",
			input:    "expect(received).toBe(expected)",
			expected: "expect(received).toBe(expected)",
		},
		{
			name:     "multiline message",
			input:    "expect(received).toBe(expected)\n\nExpected: true\nReceived: false\n\n    at Object.<anonymous>",
			expected: "expect(received).toBe(expected)",
		},
		{
			name:     "message with ansi codes",
			input:    "\x1b[31mexpect(received).toBe(expected)\x1b[39m",
			expected: "expect(received).toBe(expected)",
		},
		{
			name:     "very long message",
			input:    string(make([]byte, 300)),
			expected: string(make([]byte, 200)) + "...",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractFailureMessage(tt.input)
			if result != tt.expected {
				t.Errorf("extractFailureMessage() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestExtractTestName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple test name",
			input:    "should render correctly",
			expected: "should render correctly",
		},
		{
			name:     "test name with timing",
			input:    "should render correctly (23ms)",
			expected: "should render correctly",
		},
		{
			name:     "test name with longer timing",
			input:    "should handle async operations (1234ms)",
			expected: "should handle async operations",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractTestName(tt.input)
			if result != tt.expected {
				t.Errorf("extractTestName() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestTruncateMessage(t *testing.T) {
	shortMessage := "This is a short message"
	longMessage := string(make([]byte, 300))

	if result := truncateMessage(shortMessage); result != shortMessage {
		t.Errorf("Expected short message to be unchanged, got %q", result)
	}

	if result := truncateMessage(longMessage); len(result) != 203 { // 200 + "..."
		t.Errorf("Expected truncated message length 203, got %d", len(result))
	}

	if result := truncateMessage(longMessage); !strings.HasSuffix(result, "...") {
		t.Error("Expected truncated message to end with '...'")
	}
}

func TestParseCoverageFromMap(t *testing.T) {
	coverageMap := map[string]JestFileCoverage{
		"src/file1.js": {
			S: map[string]int{"1": 1, "2": 0, "3": 1},
		},
		"src/file2.js": {
			S: map[string]int{"1": 1, "2": 1},
		},
	}

	coverage := parseCoverageFromMap(coverageMap)

	if coverage == nil {
		t.Fatal("Expected coverage to be non-nil")
	}

	expectedPercentage := float64(4) / float64(5) * 100 // 4 covered out of 5 total
	if coverage.Percentage != expectedPercentage {
		t.Errorf("Expected percentage %f, got %f", expectedPercentage, coverage.Percentage)
	}

	if coverage.Covered != 4 {
		t.Errorf("Expected covered 4, got %d", coverage.Covered)
	}

	if coverage.Total != 5 {
		t.Errorf("Expected total 5, got %d", coverage.Total)
	}

	if len(coverage.Details) != 2 {
		t.Errorf("Expected 2 files in details, got %d", len(coverage.Details))
	}
}

func TestParseJestCoverage_InvalidFile(t *testing.T) {
	_, err := ParseJestCoverage("/nonexistent/file.json")
	if err == nil {
		t.Error("Expected error for non-existent file")
	}
}

func TestJestCoverageSummary_UnmarshalJSON_Error(t *testing.T) {
	invalidJSON := `{"total": invalid}`

	var summary JestCoverageSummary
	err := summary.UnmarshalJSON([]byte(invalidJSON))
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

func TestParseJestJSON_WithCoverageMap(t *testing.T) {
	jsonOutput := `{
  "numTotalTestSuites": 1,
  "numPassedTestSuites": 1,
  "numFailedTestSuites": 0,
  "numTotalTests": 1,
  "numPassedTests": 1,
  "numFailedTests": 0,
  "success": true,
  "testResults": [],
  "coverageMap": {
    "src/file1.js": {
      "s": {"1": 1, "2": 0, "3": 1}
    }
  }
}`

	result, err := ParseJestJSON(jsonOutput)
	if err != nil {
		t.Fatalf("ParseJestJSON failed: %v", err)
	}

	if result.Coverage == nil {
		t.Error("Expected coverage to be populated from coverageMap")
	}
}

func TestParseJestCoverage_InvalidJSON(t *testing.T) {
	// Create a temporary file with invalid JSON
	tempDir, err := os.MkdirTemp("", "jest-coverage-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	invalidJSON := `{"total": invalid json}`
	coverageFile := filepath.Join(tempDir, "coverage-summary.json")
	err = os.WriteFile(coverageFile, []byte(invalidJSON), 0644)
	if err != nil {
		t.Fatal(err)
	}

	_, err = ParseJestCoverage(coverageFile)
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

func TestParseJestTextOutput_CountFromLines(t *testing.T) {
	textOutput := `PASS src/components/Button.test.js
  Button
    ✓ should render correctly (23ms)
    ✓ should handle click (5ms)

PASS src/components/Header.test.js
  Header
    ✓ should display title (10ms)`

	result := ParseJestTextOutput(textOutput)

	// Should count from individual lines since no summary
	if result.PassedCount != 3 {
		t.Errorf("Expected PassedCount 3 from individual lines, got %d", result.PassedCount)
	}
}
