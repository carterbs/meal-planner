package parser

import (
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestParseBuildOutput_Success(t *testing.T) {
	buildOutput := `yarn run v1.22.10
$ webpack --mode production
asset main.js 1.2 KiB [emitted] [minimized] (name: main)
webpack 5.0.0 compiled successfully in 1234 ms
Done in 2.34s.`

	result := ParseBuildOutput(buildOutput)

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}

func TestParseBuildOutput_Empty(t *testing.T) {
	result := ParseBuildOutput("")

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}

func TestParseWebpackOutput_WithErrors(t *testing.T) {
	webpackOutput := `ERROR in src/components/Button.tsx:15:25
TS2304: Cannot find name 'NonExistentType'.
   13 |   const handleClick = () => {
   14 |     console.log('Button clicked');
 > 15 |   const foo: NonExistentType = 'test';
      |                         ^^^^^
   16 |   };

ERROR in src/utils/helper.js
Module build failed (from ./node_modules/babel-loader/lib/index.js):
SyntaxError: Unexpected token (5:10)

  3 | export function helper() {
  4 |   const value = 42
> 5 |   return value
    |          ^
  6 | }

webpack 5.0.0 compiled with 2 errors in 1234 ms`

	result := parseWebpackOutput(webpackOutput)

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}

	// Check first failure
	firstFailure := result.Failures[0]
	if firstFailure.File != "src/components/Button.tsx" {
		t.Errorf("Expected file 'src/components/Button.tsx', got '%s'", firstFailure.File)
	}
	if firstFailure.Line != 15 {
		t.Errorf("Expected line 15, got %d", firstFailure.Line)
	}
	if firstFailure.Type != "error" {
		t.Errorf("Expected type 'error', got '%s'", firstFailure.Type)
	}

	// Check second failure
	secondFailure := result.Failures[1]
	if secondFailure.File != "src/utils/helper.js" {
		t.Errorf("Expected file 'src/utils/helper.js', got '%s'", secondFailure.File)
	}
	if secondFailure.Type != "error" {
		t.Errorf("Expected type 'error', got '%s'", secondFailure.Type)
	}
}

func TestParseViteOutput_WithErrors(t *testing.T) {
	viteOutput := `src/components/Button.tsx:10:25: error: Cannot find name 'NonExistentType'
> 10 |   const foo: NonExistentType = 'test';
     |                         ~~~~~~~~~~~~~

src/utils/helper.ts:5:12: error: Expected ';'
> 5 |   return value
    |              ^

✘ [ERROR] Build failed with 2 errors:`

	result := parseViteOutput(viteOutput)

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}

	// Check first failure
	firstFailure := result.Failures[0]
	if firstFailure.File != "src/components/Button.tsx" {
		t.Errorf("Expected file 'src/components/Button.tsx', got '%s'", firstFailure.File)
	}
	if firstFailure.Line != 10 {
		t.Errorf("Expected line 10, got %d", firstFailure.Line)
	}
	if firstFailure.Type != "error" {
		t.Errorf("Expected type 'error', got '%s'", firstFailure.Type)
	}

	// Check second failure
	secondFailure := result.Failures[1]
	if secondFailure.File != "src/utils/helper.ts" {
		t.Errorf("Expected file 'src/utils/helper.ts', got '%s'", secondFailure.File)
	}
	if secondFailure.Line != 5 {
		t.Errorf("Expected line 5, got %d", secondFailure.Line)
	}
}

func TestParseTypeScriptOutput_WithErrors(t *testing.T) {
	tscOutput := `src/components/Button.tsx(15,25): error TS2304: Cannot find name 'NonExistentType'.
src/utils/helper.ts(5,12): error TS1005: ';' expected.
src/types/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.

10     count: "invalid"
       ~~~~~

Found 3 errors.`

	result := parseTypeScriptOutput(tscOutput)

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 3 {
		t.Errorf("Expected 3 failures, got %d", len(result.Failures))
	}

	// Check first failure (Windows style)
	firstFailure := result.Failures[0]
	if firstFailure.File != "src/components/Button.tsx" {
		t.Errorf("Expected file 'src/components/Button.tsx', got '%s'", firstFailure.File)
	}
	if firstFailure.Line != 15 {
		t.Errorf("Expected line 15, got %d", firstFailure.Line)
	}
	if firstFailure.Message != "TS2304: Cannot find name 'NonExistentType'." {
		t.Errorf("Expected TypeScript error message, got '%s'", firstFailure.Message)
	}

	// Check second failure (Windows style)
	secondFailure := result.Failures[1]
	if secondFailure.File != "src/utils/helper.ts" {
		t.Errorf("Expected file 'src/utils/helper.ts', got '%s'", secondFailure.File)
	}
	if secondFailure.Line != 5 {
		t.Errorf("Expected line 5, got %d", secondFailure.Line)
	}

	// Check third failure (Unix style)
	thirdFailure := result.Failures[2]
	if thirdFailure.File != "src/types/index.ts" {
		t.Errorf("Expected file 'src/types/index.ts', got '%s'", thirdFailure.File)
	}
	if thirdFailure.Line != 10 {
		t.Errorf("Expected line 10, got %d", thirdFailure.Line)
	}
}

func TestParseGenericBuildOutput_WithErrors(t *testing.T) {
	genericOutput := `npm ERR! code ELIFECYCLE
npm ERR! errno 1
npm ERR! project@1.0.0 build: 'webpack --mode production'
npm ERR! Exit status 1
npm ERR! Failed at the project@1.0.0 build script.

Error: Build failed with errors
    at /path/to/project/build.js:15:20

Build process failed with exit code 1`

	result := parseGenericBuildOutput(genericOutput)

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) == 0 {
		t.Error("Expected failures to be populated")
	}

	// Check that errors were detected
	hasError := false
	for _, failure := range result.Failures {
		if failure.Type == "error" {
			hasError = true
			break
		}
	}
	if !hasError {
		t.Error("Expected at least one error failure")
	}
}

func TestExtractFileName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple file path",
			input:    "src/components/Button.tsx",
			expected: "src/components/Button.tsx",
		},
		{
			name:     "webpack loader prefix",
			input:    "babel-loader!src/components/Button.js",
			expected: "src/components/Button.js",
		},
		{
			name:     "complex webpack loader",
			input:    "css-loader!sass-loader!src/styles/main.scss",
			expected: "src/styles/main.scss",
		},
		{
			name:     "file with query params",
			input:    "src/components/Button.tsx?vue&type=script",
			expected: "src/components/Button.tsx",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractFileName(tt.input)
			if result != tt.expected {
				t.Errorf("extractFileName() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestExtractLineNumber(t *testing.T) {
	tests := []struct {
		name       string
		filePath   string
		errorLines []string
		expected   int
	}{
		{
			name:       "line number in file path",
			filePath:   "src/components/Button.tsx:15:25",
			errorLines: []string{},
			expected:   15,
		},
		{
			name:       "no line number",
			filePath:   "src/components/Button.tsx",
			errorLines: []string{"Some error message"},
			expected:   0,
		},
		{
			name:       "line number in error lines",
			filePath:   "src/components/Button.tsx",
			errorLines: []string{"Error at line :42:", "Other info"},
			expected:   42,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractLineNumber(tt.filePath, tt.errorLines)
			if result != tt.expected {
				t.Errorf("extractLineNumber() = %d, want %d", result, tt.expected)
			}
		})
	}
}

func TestExtractErrorMessage(t *testing.T) {
	tests := []struct {
		name       string
		errorLines []string
		expected   string
	}{
		{
			name:       "empty error lines",
			errorLines: []string{},
			expected:   "Build error",
		},
		{
			name:       "meaningful error line",
			errorLines: []string{"Cannot find name 'NonExistentType'", "    at Object.<anonymous>"},
			expected:   "Cannot find name 'NonExistentType'",
		},
		{
			name:       "only stack trace",
			errorLines: []string{"    at Object.<anonymous>", "    at Module._compile"},
			expected:   "Build error",
		},
		{
			name:       "mixed content",
			errorLines: []string{"", "Syntax error occurred", "    at line 42", "Additional context"},
			expected:   "Syntax error occurred",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractErrorMessage(tt.errorLines)
			if result != tt.expected {
				t.Errorf("extractErrorMessage() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestParseInt(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int
	}{
		{"valid number", "42", 42},
		{"zero", "0", 0},
		{"invalid string", "abc", 0},
		{"empty string", "", 0},
		{"negative number", "-5", -5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseInt(tt.input)
			if result != tt.expected {
				t.Errorf("parseInt() = %d, want %d", result, tt.expected)
			}
		})
	}
}

func TestParseBuildOutput_AllParsers(t *testing.T) {
	// Test that all parsers are called
	viteOutput := `src/main.tsx:5:10: error: Cannot find module 'missing'`
	result := ParseBuildOutput(viteOutput)
	
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) == 0 {
		t.Error("Expected failures from Vite parser")
	}
}

func TestParseWebpackOutput_ModuleBuildFailed(t *testing.T) {
	webpackOutput := `ERROR in src/utils/helper.js
Module build failed (from ./node_modules/babel-loader/lib/index.js):
SyntaxError: Unexpected token (5:10)

  3 | export function helper() {
  4 |   const value = 42
> 5 |   return value
    |          ^
  6 | }`

	result := parseWebpackOutput(webpackOutput)

	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 1 {
		t.Errorf("Expected 1 failure, got %d", len(result.Failures))
	}
	
	failure := result.Failures[0]
	if failure.File != "src/utils/helper.js" {
		t.Errorf("Expected file 'src/utils/helper.js', got '%s'", failure.File)
	}
}

func TestExtractFileName_LineColumnInfo(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "with line and column",
			input:    "src/components/Button.tsx:15:25",
			expected: "src/components/Button.tsx",
		},
		{
			name:     "no line column info",
			input:    "src/components/Button.tsx",
			expected: "src/components/Button.tsx",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractFileName(tt.input)
			if result != tt.expected {
				t.Errorf("extractFileName() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestExtractErrorMessage_EmptyLines(t *testing.T) {
	tests := []struct {
		name       string
		errorLines []string
		expected   string
	}{
		{
			name:       "all empty lines",
			errorLines: []string{"", "   ", "\t"},
			expected:   "Build error",
		},
		{
			name:       "single meaningful line",
			errorLines: []string{"", "Error: Something went wrong", ""},
			expected:   "Error: Something went wrong",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractErrorMessage(tt.errorLines)
			if result != tt.expected {
				t.Errorf("extractErrorMessage() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestParseGenericBuildOutput_NoErrors(t *testing.T) {
	cleanOutput := `yarn run v1.22.10
$ webpack --mode production
Done in 2.34s.`

	result := parseGenericBuildOutput(cleanOutput)

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}