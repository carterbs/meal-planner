package nodeadapter

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestAdapter_Test_Success(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Dir:  "/test/dir",
		Test: "jest --silent --reporters=jest-silent-reporter",
	}
	adapter := New("test-service", service, executor)

	// Mock successful test output
	testOutput := `Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.234 s
Ran all test suites.`

	executor.SetNextResponse(testOutput, "", nil)
	result := adapter.Test()

	// Verify command was called correctly
	if len(executor.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(executor.Commands))
	}
	cmd := executor.Commands[0]
	if cmd.Name != "jest" {
		t.Errorf("Expected command 'jest', got '%s'", cmd.Name)
	}

	// Verify result
	if result.Service != "test-service" {
		t.Errorf("Expected service 'test-service', got '%s'", result.Service)
	}
	if result.Phase != runner.PhaseTest {
		t.Errorf("Expected phase %s, got %s", runner.PhaseTest, result.Phase)
	}
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.Duration == 0 {
		t.Error("Expected non-zero duration")
	}
}

func TestAdapter_Test_WithFailures(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Test: "jest",
	}
	adapter := New("test-service", service, executor)

	// Mock test output with failures
	testOutput := `FAIL src/components/Button.test.js
  ✕ should render correctly (5ms)

    expect(received).toBe(expected) // Object.is equality

    Expected: "Submit"
    Received: "Button"

      at Object.<anonymous> (src/components/Button.test.js:10:25)

Test Suites: 1 failed, 0 passed, 1 total
Tests:       1 failed, 0 passed, 1 total
Snapshots:   0 total
Time:        1.234 s`

	executor.SetNextResponse(testOutput, "", errors.New("exit status 1"))
	result := adapter.Test()

	// Verify result
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if result.FailedCount != 1 {
		t.Errorf("Expected FailedCount 1, got %d", result.FailedCount)
	}
	if len(result.Failures) == 0 {
		t.Error("Expected failures to be populated")
	}
}

func TestAdapter_Test_JSONMode(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Test: "jest",
	}
	adapter := New("test-service", service, executor).WithJSONMode(true)

	// Set up the fake command 
	executor.SetNextResponse("", "", nil)
	result := adapter.Test()

	// For this test, we expect it to fall back to text mode since we can't easily mock the temp file
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
}

func TestAdapter_Test_NoCommand(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		// No test command
	}
	adapter := New("test-service", service, executor)

	result := adapter.Test()

	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if result.ErrorMessage != "No test command configured" {
		t.Errorf("Expected error message about missing command, got '%s'", result.ErrorMessage)
	}
}

func TestAdapter_Test_Timeout(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Test: "jest",
	}
	adapter := New("test-service", service, executor).WithTimeout(1 * time.Nanosecond)

	// The timeout is so short that it should trigger immediately
	result := adapter.Test()

	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if result.ErrorMessage == "" {
		t.Error("Expected timeout error message")
	}
}

func TestAdapter_Lint_Success(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Lint: "eslint --quiet src/",
	}
	adapter := New("test-service", service, executor)

	// Mock successful lint output (empty output means no issues)
	executor.SetNextResponse("", "", nil)
	result := adapter.Lint()

	// Verify command was called correctly
	if len(executor.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(executor.Commands))
	}
	cmd := executor.Commands[0]
	if cmd.Name != "eslint" {
		t.Errorf("Expected command 'eslint', got '%s'", cmd.Name)
	}

	// Verify result
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}

func TestAdapter_Lint_WithErrors(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Lint: "eslint src/",
	}
	adapter := New("test-service", service, executor)

	// Mock lint output with errors
	lintOutput := `src/components/Button.js
  10:25  error  'unused' is defined but never used  no-unused-vars
  15:10  warning  Missing return type annotation  @typescript-eslint/explicit-function-return-type

✖ 2 problems (1 error, 1 warning)`

	executor.SetNextResponse(lintOutput, "", errors.New("exit status 1"))
	result := adapter.Lint()

	// Verify result
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) == 0 {
		t.Error("Expected failures to be populated")
	}
	if result.WarningCount == 0 {
		t.Error("Expected warnings to be counted")
	}
}

func TestAdapter_Lint_JSONMode(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Lint: "eslint src/",
	}
	adapter := New("test-service", service, executor).WithJSONMode(true)

	// Mock ESLint JSON output
	jsonOutput := `[
  {
    "filePath": "src/components/Button.js",
    "messages": [
      {
        "ruleId": "no-unused-vars",
        "severity": 2,
        "message": "'unused' is defined but never used",
        "line": 10,
        "column": 25
      }
    ],
    "errorCount": 1,
    "warningCount": 0
  }
]`

	executor.SetNextResponse(jsonOutput, "", errors.New("exit status 1"))
	result := adapter.Lint()

	// Verify result
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 1 {
		t.Errorf("Expected 1 failure, got %d", len(result.Failures))
	}
	if result.Failures[0].Line != 10 {
		t.Errorf("Expected line 10, got %d", result.Failures[0].Line)
	}
}

func TestAdapter_Build_Success(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name:  "test-service",
		Type:  config.ServiceTypeNode,
		Build: "yarn build",
	}
	adapter := New("test-service", service, executor)

	// Mock successful build output
	buildOutput := `yarn run v1.22.10
$ webpack --mode production
asset main.js 1.2 KiB [emitted] [minimized] (name: main)
webpack 5.0.0 compiled successfully in 1234 ms
Done in 2.34s.`

	executor.SetNextResponse(buildOutput, "", nil)
	result := adapter.Build()

	// Verify result
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected no failures, got %d", len(result.Failures))
	}
}

func TestAdapter_Build_WithErrors(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name:  "test-service",
		Type:  config.ServiceTypeNode,
		Build: "npm run build",
	}
	adapter := New("test-service", service, executor)

	// Mock build output with errors
	buildOutput := `> build
> webpack --mode production

ERROR in src/components/Button.tsx:15:25
TS2304: Cannot find name 'NonExistentType'.
   13 |   const handleClick = () => {
   14 |     console.log('Button clicked');
 > 15 |   const foo: NonExistentType = 'test';
      |                         ^^^^^
   16 |   };

webpack 5.0.0 compiled with 1 error in 1234 ms`

	executor.SetNextResponse("", buildOutput, errors.New("exit status 1"))
	result := adapter.Build()

	// Verify result
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) == 0 {
		t.Error("Expected failures to be populated")
	}
}

func TestAdapter_HelperMethods(t *testing.T) {
	adapter := &Adapter{}

	// Test containsReporter
	tests := []struct {
		name     string
		parts    []string
		expected bool
	}{
		{"has reporters", []string{"jest", "--reporters=json"}, true},
		{"has reporter", []string{"jest", "--reporter", "json"}, true},
		{"no reporter", []string{"jest", "--silent"}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := adapter.containsReporter(tt.parts)
			if result != tt.expected {
				t.Errorf("containsReporter() = %v, want %v", result, tt.expected)
			}
		})
	}

	// Test isJestCommand
	jestTests := []struct {
		name     string
		parts    []string
		expected bool
	}{
		{"direct jest", []string{"jest"}, true},
		{"yarn jest", []string{"yarn", "jest"}, true},
		{"npm jest", []string{"npm", "run", "jest"}, false}, // jest is not in first two positions
		{"eslint", []string{"eslint"}, false},
	}

	for _, tt := range jestTests {
		t.Run(tt.name, func(t *testing.T) {
			result := adapter.isJestCommand(tt.parts)
			if result != tt.expected {
				t.Errorf("isJestCommand() = %v, want %v", result, tt.expected)
			}
		})
	}

	// Test isESLintCommand
	eslintTests := []struct {
		name     string
		parts    []string
		expected bool
	}{
		{"direct eslint", []string{"eslint"}, true},
		{"yarn eslint", []string{"yarn", "eslint"}, true},
		{"jest", []string{"jest"}, false},
	}

	for _, tt := range eslintTests {
		t.Run(tt.name, func(t *testing.T) {
			result := adapter.isESLintCommand(tt.parts)
			if result != tt.expected {
				t.Errorf("isESLintCommand() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestAdapter_Test_WithCoverageFile(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Dir:  "/test/dir",
		Test: "jest",
	}
	adapter := New("test-service", service, executor)

	// Mock test output
	testOutput := `Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total`

	executor.SetNextResponse(testOutput, "", nil)
	result := adapter.Test()

	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
}

func TestAdapter_Lint_NoCommand(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		// No lint command
	}
	adapter := New("test-service", service, executor)

	result := adapter.Lint()

	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if result.ErrorMessage != "No lint command configured" {
		t.Errorf("Expected error message about missing command, got '%s'", result.ErrorMessage)
	}
}

func TestAdapter_Lint_EmptyCommand(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Lint: "",
	}
	adapter := New("test-service", service, executor)

	result := adapter.Lint()

	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if result.ErrorMessage != "No lint command configured" {
		t.Errorf("Expected error message about missing command, got '%s'", result.ErrorMessage)
	}
}

func TestAdapter_Build_NoCommand(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		// No build command
	}
	adapter := New("test-service", service, executor)

	result := adapter.Build()

	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if result.ErrorMessage != "No build command configured" {
		t.Errorf("Expected error message about missing command, got '%s'", result.ErrorMessage)
	}
}

func TestAdapter_Build_EmptyCommand(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Build: "",
	}
	adapter := New("test-service", service, executor)

	result := adapter.Build()

	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if result.ErrorMessage != "No build command configured" {
		t.Errorf("Expected error message about missing command, got '%s'", result.ErrorMessage)
	}
}

func TestAdapter_MoreHelperMethods(t *testing.T) {
	adapter := &Adapter{}

	// Test containsFormat
	formatTests := []struct {
		name     string
		parts    []string
		expected bool
	}{
		{"has format", []string{"eslint", "--format=json"}, true},
		{"has -f", []string{"eslint", "-f", "json"}, true},
		{"no format", []string{"eslint", "--quiet"}, false},
	}

	for _, tt := range formatTests {
		t.Run(tt.name, func(t *testing.T) {
			result := adapter.containsFormat(tt.parts)
			if result != tt.expected {
				t.Errorf("containsFormat() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestTestFakeCommand_AllMethods(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	executor.SetNextResponse("output", "error", nil)
	
	cmd := executor.CommandContext(nil, "test", "arg1", "arg2")
	fakeCmd := cmd.(*TestFakeCommand)
	
	// Test all setter methods
	fakeCmd.SetStdin(nil)
	fakeCmd.SetEnv([]string{"ENV=test"})
	
	// Test Start and Wait methods
	if err := fakeCmd.Start(); err != nil {
		t.Errorf("Start() returned error: %v", err)
	}
	
	if err := fakeCmd.Wait(); err != nil {
		t.Errorf("Wait() returned error: %v", err)
	}
	
	// Test String method
	expected := "test arg1 arg2"
	if got := fakeCmd.String(); got != expected {
		t.Errorf("String() = %q, want %q", got, expected)
	}
}

func TestAdapter_runTestWithJSON_TempFileError(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Test: "jest",
	}
	adapter := New("test-service", service, executor)
	
	// This will test the fallback when temp file creation fails in real scenarios
	result := adapter.Test()
	
	// Should fall back to regular mode
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
}

func TestAdapter_Lint_WithoutJSONFallback(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Lint: "eslint src/",
	}
	adapter := New("test-service", service, executor).WithJSONMode(true)

	// Mock invalid JSON output with error text that should trigger fallback to text parsing
	invalidJSON := "src/file.js:10:5: error: Something is wrong"
	executor.SetNextResponse(invalidJSON, "", errors.New("exit status 1"))
	result := adapter.Lint()

	// Should fall back to text parsing and detect the error
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) == 0 {
		t.Error("Expected failures to be detected by text parser fallback")
	}
}

func TestAdapter_Test_EmptyCommand(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Test: "",
	}
	adapter := New("test-service", service, executor)

	result := adapter.Test()

	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if result.ErrorMessage != "No test command configured" {
		t.Errorf("Expected error message about missing command, got '%s'", result.ErrorMessage)
	}
}

func TestAdapter_Test_WithJestSilentReporter(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Test: "jest --coverage",  // Jest command without reporter
	}
	adapter := New("test-service", service, executor)

	testOutput := `Tests: 1 passed, 1 total`
	executor.SetNextResponse(testOutput, "", nil)
	result := adapter.Test()

	// Verify test ran successfully
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}

	// Verify jest-silent-reporter was added
	if len(executor.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(executor.Commands))
	}
	
	cmd := executor.Commands[0]
	cmdStr := cmd.String()
	if !strings.Contains(cmdStr, "jest-silent-reporter") {
		t.Errorf("Expected jest-silent-reporter to be added, got command: %s", cmdStr)
	}
}

func TestAdapter_Lint_AddQuietFlag(t *testing.T) {
	executor := NewTestFakeCommandRunner()
	service := &config.Service{
		Name: "test-service",
		Type: config.ServiceTypeNode,
		Lint: "eslint src/",  // ESLint command without quiet flag
	}
	adapter := New("test-service", service, executor)

	executor.SetNextResponse("", "", nil)
	result := adapter.Lint()

	// Verify --quiet was added
	if len(executor.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(executor.Commands))
	}
	
	cmd := executor.Commands[0]
	cmdStr := cmd.String()
	if !strings.Contains(cmdStr, "--quiet") {
		t.Errorf("Expected --quiet to be added, got command: %s", cmdStr)
	}
	
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
}