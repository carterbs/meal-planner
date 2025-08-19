package nodeadapter

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestAdapter_LintFile_Success(t *testing.T) {
	service := &config.Service{
		Name: "test-service",
		Type: "node",
		Dir:  "/test/service",
		Lint: "yarn lint",
	}
	executor := NewTestFakeCommandRunner()
	adapter := New("test-service", service, executor)

	// Empty JSON array means no issues
	executor.SetNextResponse("[]", "", nil)

	result := adapter.LintFile("/test/service/src/main.ts")

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
	if cmd.Name != "yarn" {
		t.Errorf("expected command 'yarn', got %s", cmd.Name)
	}
}

func TestAdapter_LintFile_WithIssues(t *testing.T) {
	service := &config.Service{
		Name: "test-service",
		Type: "node",
		Dir:  "/test/service",
		Lint: "yarn lint",
	}
	executor := NewTestFakeCommandRunner()
	adapter := New("test-service", service, executor)

	jsonOutput := `[
		{
			"filePath": "src/main.ts",
			"messages": [
				{
					"ruleId": "no-unused-vars",
					"severity": 2,
					"message": "Variable 'unused' is defined but never used",
					"line": 10,
					"column": 5
				}
			],
			"errorCount": 1,
			"warningCount": 0
		}
	]`
	executor.SetNextResponse(jsonOutput, "", nil)

	result := adapter.LintFile("/test/service/src/main.ts")

	if result.Status != runner.StatusFailure {
		t.Errorf("expected status failure, got %v", result.Status)
	}
	if len(result.Failures) != 1 {
		t.Fatalf("expected 1 failure, got %d", len(result.Failures))
	}

	failure := result.Failures[0]
	expectedMsg := "Variable 'unused' is defined but never used (no-unused-vars)"
	if failure.Message != expectedMsg {
		t.Errorf("unexpected failure message: got %s, expected %s", failure.Message, expectedMsg)
	}
}

func TestAdapter_LintFile_NoLintCommand(t *testing.T) {
	service := &config.Service{
		Name: "test-service",
		Type: "node",
		Dir:  "/test/service",
		// No lint command
	}
	executor := NewTestFakeCommandRunner()
	adapter := New("test-service", service, executor)

	result := adapter.LintFile("/test/service/main.ts")

	if result.Status != runner.StatusError {
		t.Errorf("expected status error, got %v", result.Status)
	}
	if result.ErrorMessage != "No lint command configured" {
		t.Errorf("unexpected error message: %s", result.ErrorMessage)
	}
}

func TestAdapter_LintFile_RelativePathResolution(t *testing.T) {
	// Use current working directory + relative path to simulate real config
	cwd, _ := os.Getwd()
	service := &config.Service{
		Name: "test-service",
		Type: "node",
		Dir:  "./ui", // Relative path like in real config
		Lint: "yarn lint",
	}
	executor := NewTestFakeCommandRunner()
	adapter := New("test-service", service, executor)

	// Empty JSON array means no issues
	executor.SetNextResponse("[]", "", nil)

	// Create absolute path that would actually be within the service dir
	absServiceDir := filepath.Join(cwd, "ui")
	testFilePath := filepath.Join(absServiceDir, "src", "components", "Button.tsx")

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
	expectedRelativePath := filepath.Join("src", "components", "Button.tsx")
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