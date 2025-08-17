package goadapter

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestAdapter_Test_Success(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Mock successful test output
	testOutput := `{"Time":"2024-01-01T10:00:00Z","Action":"run","Package":"github.com/test/pkg","Test":"TestExample"}
{"Time":"2024-01-01T10:00:01Z","Action":"output","Package":"github.com/test/pkg","Test":"TestExample","Output":"=== RUN   TestExample\n"}
{"Time":"2024-01-01T10:00:02Z","Action":"pass","Package":"github.com/test/pkg","Test":"TestExample","Elapsed":1.0}
{"Time":"2024-01-01T10:00:03Z","Action":"output","Package":"github.com/test/pkg","Output":"coverage: 85.7% of statements\n"}
{"Time":"2024-01-01T10:00:04Z","Action":"pass","Package":"github.com/test/pkg","Elapsed":2.0}`

	executor.SetNextResponse(testOutput, "", nil)
	result := adapter.Test()

	// Verify command was called correctly
	if len(executor.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(executor.Commands))
	}
	cmd := executor.Commands[0]
	if cmd.Name != "go" {
		t.Errorf("Expected command 'go', got '%s'", cmd.Name)
	}
	expectedArgs := []string{"test", "./...", "-json", "-cover", "-coverprofile=coverage.out"}
	if len(cmd.Args) != len(expectedArgs) {
		t.Errorf("Expected args %v, got %v", expectedArgs, cmd.Args)
	}
	for i, arg := range expectedArgs {
		if i >= len(cmd.Args) || cmd.Args[i] != arg {
			t.Errorf("Expected arg[%d] = '%s', got '%s'", i, arg, cmd.Args[i])
		}
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

func TestAdapter_Test_Failure(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Mock failed test output
	testOutput := `{"Time":"2024-01-01T10:00:00Z","Action":"run","Package":"github.com/test/pkg","Test":"TestExample"}
{"Time":"2024-01-01T10:00:01Z","Action":"output","Package":"github.com/test/pkg","Test":"TestExample","Output":"=== RUN   TestExample\n"}
{"Time":"2024-01-01T10:00:02Z","Action":"output","Package":"github.com/test/pkg","Test":"TestExample","Output":"    main_test.go:10: assertion failed\n"}
{"Time":"2024-01-01T10:00:03Z","Action":"fail","Package":"github.com/test/pkg","Test":"TestExample","Elapsed":1.0}
{"Time":"2024-01-01T10:00:04Z","Action":"fail","Package":"github.com/test/pkg","Elapsed":2.0}`

	executor.SetNextResponse(testOutput, "", errors.New("exit status 1"))
	result := adapter.Test()

	// Verify result
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
		if !contains(failure.Message, "assertion failed") {
			t.Errorf("Expected failure message to contain 'assertion failed', got '%s'", failure.Message)
		}
	}
}

func TestAdapter_Test_Timeout(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor).WithTimeout(1 * time.Millisecond)

	executor.SetNextResponse("", "", context.DeadlineExceeded)
	result := adapter.Test()

	// Verify result
	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if !contains(result.ErrorMessage, "timed out") {
		t.Errorf("Expected error message to contain 'timed out', got '%s'", result.ErrorMessage)
	}
}

func TestAdapter_Test_EmptyOutput(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	executor.SetNextResponse("", "", nil)
	result := adapter.Test()

	// Verify result
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

func TestAdapter_Test_MalformedJSON(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Set up fake command with malformed JSON
	testOutput := `{"Time":"2024-01-01T10:00:00Z","Action":"run"
{"invalid json line
{"Time":"2024-01-01T10:00:02Z","Action":"pass","Package":"github.com/test/pkg","Test":"TestExample","Elapsed":1.0}`

	executor.SetNextResponse(testOutput, "", nil)
	result := adapter.Test()

	// Should still succeed since parser skips malformed lines
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.PassedCount != 1 {
		t.Errorf("Expected PassedCount 1, got %d", result.PassedCount)
	}
}

func TestAdapter_Lint_Success(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Mock successful lint output (empty JSON = no issues)
	lintOutput := `{"Issues":[]}`

	executor.SetNextResponse(lintOutput, "", nil)
	result := adapter.Lint()

	// Verify command was called correctly
	if len(executor.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(executor.Commands))
	}
	cmd := executor.Commands[0]
	if cmd.Name != "golangci-lint" {
		t.Errorf("Expected command 'golangci-lint', got '%s'", cmd.Name)
	}
	expectedArgs := []string{"run", "--out-format", "json"}
	if len(cmd.Args) != len(expectedArgs) {
		t.Errorf("Expected args %v, got %v", expectedArgs, cmd.Args)
	}

	// Verify result
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

func TestAdapter_Lint_WithIssues(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Mock lint output with issues
	lintOutput := `{
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
			}
		]
	}`

	executor.SetNextResponse(lintOutput, "", errors.New("exit status 1"))
	result := adapter.Lint()

	// Verify result
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if result.WarningCount != 1 {
		t.Errorf("Expected WarningCount 1, got %d", result.WarningCount)
	}
	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}

	// Check warning
	found := false
	for _, failure := range result.Failures {
		if failure.Type == "warning" && contains(failure.Message, "deadcode") {
			found = true
			if failure.File != "main.go" {
				t.Errorf("Expected warning file 'main.go', got '%s'", failure.File)
			}
			if failure.Line != 15 {
				t.Errorf("Expected warning line 15, got %d", failure.Line)
			}
		}
	}
	if !found {
		t.Error("Expected to find warning failure")
	}

	// Check error
	found = false
	for _, failure := range result.Failures {
		if failure.Type == "error" && contains(failure.Message, "errcheck") {
			found = true
		}
	}
	if !found {
		t.Error("Expected to find error failure")
	}
}

func TestAdapter_Lint_TextFallback(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Mock text output (not JSON)
	lintOutput := `main.go:15:1: function 'unused' is never used (deadcode)
main.go:20:5: Error return value of 'fmt.Println' is not checked (errcheck)`

	executor.SetNextResponse(lintOutput, "", errors.New("exit status 1"))
	result := adapter.Lint()

	// Verify result
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) != 2 {
		t.Errorf("Expected 2 failures, got %d", len(result.Failures))
	}
}

func TestAdapter_Build_Success(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	executor.SetNextResponse("", "", nil)
	result := adapter.Build()

	// Verify command was called correctly
	if len(executor.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(executor.Commands))
	}
	cmd := executor.Commands[0]
	if cmd.Name != "go" {
		t.Errorf("Expected command 'go', got '%s'", cmd.Name)
	}
	expectedArgs := []string{"build", "./..."}
	if len(cmd.Args) != len(expectedArgs) {
		t.Errorf("Expected args %v, got %v", expectedArgs, cmd.Args)
	}

	// Verify result
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if len(result.Failures) != 0 {
		t.Errorf("Expected 0 failures, got %d", len(result.Failures))
	}
}

func TestAdapter_Build_Failure(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Mock build failure
	buildOutput := `# github.com/test/pkg
main.go:15:2: undefined: unknownFunction
main.go:20:5: syntax error: unexpected }`

	executor.SetNextResponse("", buildOutput, errors.New("exit status 2"))
	result := adapter.Build()

	// Verify result
	if result.Status != runner.StatusFailure {
		t.Errorf("Expected status %s, got %s", runner.StatusFailure, result.Status)
	}
	if len(result.Failures) == 0 {
		t.Error("Expected build failures")
	}

	// Check that failures contain build errors
	for _, failure := range result.Failures {
		if failure.Type != "build" {
			t.Errorf("Expected failure type 'build', got '%s'", failure.Type)
		}
	}
}

func TestAdapter_Build_Timeout(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor).WithTimeout(1 * time.Millisecond)

	executor.SetNextResponse("", "", context.DeadlineExceeded)
	result := adapter.Build()

	// Verify result
	if result.Status != runner.StatusError {
		t.Errorf("Expected status %s, got %s", runner.StatusError, result.Status)
	}
	if !contains(result.ErrorMessage, "timed out") {
		t.Errorf("Expected error message to contain 'timed out', got '%s'", result.ErrorMessage)
	}
}

func TestAdapter_Test_CommandSuccessWithParseFailure(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Mock output that has good JSON but indicates success
	testOutput := `{"Time":"2024-01-01T10:00:00Z","Action":"pass","Package":"github.com/test/pkg","Elapsed":1.0}`

	// Command succeeds but let's test the case where command error exists but parsing indicates success
	executor.SetNextResponse(testOutput, "", errors.New("exit status 1"))
	result := adapter.Test()

	// Parser should take precedence over command error
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
}

func TestAdapter_Test_CoverageFileExists(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// Mock test output without coverage data in JSON
	testOutput := `{"Time":"2024-01-01T10:00:00Z","Action":"run","Package":"github.com/test/pkg","Test":"TestExample"}
{"Time":"2024-01-01T10:00:01Z","Action":"pass","Package":"github.com/test/pkg","Test":"TestExample","Elapsed":1.0}`

	executor.SetNextResponse(testOutput, "", nil)
	result := adapter.Test()

	// Should still be successful even without coverage
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
	if result.PassedCount != 1 {
		t.Errorf("Expected PassedCount 1, got %d", result.PassedCount)
	}
}

func TestAdapter_Build_ParseError(t *testing.T) {
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", "/test/dir", executor)

	// This would be very unusual but let's test for safety
	executor.SetNextResponse("", "some output", nil)

	// Create a modified adapter that would cause a parse error
	// We can't actually trigger parse errors easily in the build parser
	// since it's very forgiving, but we can test the successful path
	result := adapter.Build()

	// Should succeed with no failures
	if result.Status != runner.StatusSuccess {
		t.Errorf("Expected status %s, got %s", runner.StatusSuccess, result.Status)
	}
}
