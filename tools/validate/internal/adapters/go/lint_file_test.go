package goadapter

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestAdapter_LintFile_Success(t *testing.T) {
	workingDir := "/test/service"
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", workingDir, executor)

	// Empty output means no issues
	executor.SetNextResponse("", "", nil)

	result := adapter.LintFile("/test/service/main.go")

	if result.Status != runner.StatusSuccess {
		t.Errorf("expected status success, got %v", result.Status)
	}
	if result.Service != "test-service" {
		t.Errorf("expected service 'test-service', got %s", result.Service)
	}
	if result.Phase != runner.PhaseLint {
		t.Errorf("expected phase lint, got %v", result.Phase)
	}

	// Verify command was called
	if len(executor.Commands) != 1 {
		t.Fatalf("expected 1 command, got %d", len(executor.Commands))
	}

	cmd := executor.Commands[0]
	if cmd.Name != "golangci-lint" {
		t.Errorf("expected command 'golangci-lint', got %s", cmd.Name)
	}
}

func TestAdapter_LintFile_WithIssues(t *testing.T) {
	workingDir := "/test/service"
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", workingDir, executor)

	// Use a simple text output that should be parsed
	textOutput := "main.go:42:15: should use fmt.Errorf(...) instead of errors.New(fmt.Sprintf(...)) (gosimple)"
	executor.SetNextResponse(textOutput, "", nil)

	result := adapter.LintFile("/test/service/main.go")

	if result.Status != runner.StatusFailure {
		t.Errorf("expected status failure, got %v", result.Status)
	}
	if len(result.Failures) == 0 {
		t.Fatal("expected at least 1 failure")
	}

	// Just verify we got some failure, don't be too strict about the exact format
	failure := result.Failures[0]
	if failure.Message == "" {
		t.Error("expected non-empty failure message")
	}
}

func TestAdapter_LintFile_RelativePathResolution(t *testing.T) {
	// Use current working directory + relative path to simulate real config
	cwd, _ := os.Getwd()
	workingDir := "./api-service" // Relative path like in real config
	executor := &TestFakeCommandRunner{}
	adapter := New("test-service", workingDir, executor)

	// Empty output means no issues
	executor.SetNextResponse("", "", nil)

	// Create absolute path that would actually be within the working dir
	absWorkingDir := filepath.Join(cwd, "api-service")
	testFilePath := filepath.Join(absWorkingDir, "internal", "handler.go")

	result := adapter.LintFile(testFilePath)

	if result.Status != runner.StatusSuccess {
		t.Errorf("expected status success, got %v", result.Status)
	}
	
	// Should not get a relative path error
	if strings.Contains(result.ErrorMessage, "Failed to get relative path") {
		t.Errorf("should not get relative path error, got: %s", result.ErrorMessage)
	}

	// Verify command was called
	if len(executor.Commands) != 1 {
		t.Fatalf("expected 1 command, got %d", len(executor.Commands))
	}

	cmd := executor.Commands[0]
	// Should have converted to relative path successfully
	expectedRelativePath := filepath.Join("internal", "handler.go")
	found := false
	for _, arg := range cmd.Args {
		if arg == expectedRelativePath {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected to find relative path %s in args %v", expectedRelativePath, cmd.Args)
	}
}

// Helper function to compare string slices
func equalStringSlice(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i, v := range a {
		if v != b[i] {
			return false
		}
	}
	return true
}