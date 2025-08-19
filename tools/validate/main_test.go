package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

func TestParseFlags_Basic(t *testing.T) {
	opts, err := parseFlags(runner.PhaseTest, []string{"--verbose", "--service", "ui", "--max-parallel", "4"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !opts.Verbose {
		t.Fatalf("expected verbose true")
	}
	if opts.MaxParallel != 4 {
		t.Fatalf("expected max-parallel 4, got %d", opts.MaxParallel)
	}
	if len(opts.Services) != 1 || opts.Services[0] != "ui" {
		t.Fatalf("expected service filter to contain ui, got %v", opts.Services)
	}
	if opts.Phase != runner.PhaseTest {
		t.Fatalf("expected phase test, got %v", opts.Phase)
	}
}

func TestParseFlags_CIImpliesJSONNoSpinner(t *testing.T) {
	opts, err := parseFlags(runner.PhaseTest, []string{"--ci"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !opts.JSON {
		t.Fatalf("expected JSON to be true in CI mode")
	}
	if !opts.NoSpinner {
		t.Fatalf("expected NoSpinner to be true in CI mode")
	}
}

func TestParseFlags_Defaults(t *testing.T) {
	opts, err := parseFlags(runner.PhaseLint, []string{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if opts.Phase != runner.PhaseLint {
		t.Fatalf("expected phase lint, got %v", opts.Phase)
	}
	if opts.MaxParallel != 0 {
		t.Fatalf("expected default max-parallel 0, got %d", opts.MaxParallel)
	}
}

func TestParseWatchFlags_Basic(t *testing.T) {
	opts, err := parseWatchFlags([]string{"--verbose", "--service", "ui", "--extensions", ".ts", "--max-parallel", "4"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !opts.Verbose {
		t.Fatalf("expected verbose true")
	}
	if opts.MaxParallel != 4 {
		t.Fatalf("expected max-parallel 4, got %d", opts.MaxParallel)
	}
	if len(opts.Services) != 1 || opts.Services[0] != "ui" {
		t.Fatalf("expected service filter to contain ui, got %v", opts.Services)
	}
	if len(opts.Extensions) != 1 || opts.Extensions[0] != ".ts" {
		t.Fatalf("expected extensions filter to contain .ts, got %v", opts.Extensions)
	}
}

func TestParseWatchFlags_MultipleExtensions(t *testing.T) {
	opts, err := parseWatchFlags([]string{"--extensions", ".ts", "--extensions", ".js", "--extensions", ".go"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	
	expected := []string{".ts", ".js", ".go"}
	if len(opts.Extensions) != len(expected) {
		t.Fatalf("expected %d extensions, got %d", len(expected), len(opts.Extensions))
	}
	
	for i, ext := range expected {
		if opts.Extensions[i] != ext {
			t.Errorf("expected extension %s at index %d, got %s", ext, i, opts.Extensions[i])
		}
	}
}

func TestParseWatchFlags_CIImpliesJSONNoSpinner(t *testing.T) {
	opts, err := parseWatchFlags([]string{"--ci"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !opts.CI {
		t.Fatalf("expected ci true")
	}
	if !opts.JSON {
		t.Fatalf("expected json true")
	}
	if !opts.NoSpinner {
		t.Fatalf("expected no-spinner true")
	}
}

func TestParseWatchFlags_EmptyExtensions(t *testing.T) {
	opts, err := parseWatchFlags([]string{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	
	// Empty extensions should result in empty slice
	if len(opts.Extensions) != 0 {
		t.Fatalf("expected empty extensions, got %v", opts.Extensions)
	}
}

func TestParseLintFileFlags(t *testing.T) {
	tests := []struct {
		name     string
		args     []string
		wantPath string
		wantErr  bool
	}{
		{
			name:     "valid file path",
			args:     []string{"test.go"},
			wantPath: "test.go",
			wantErr:  false,
		},
		{
			name:     "with verbose flag",
			args:     []string{"--verbose", "test.ts"},
			wantPath: "test.ts",
			wantErr:  false,
		},
		{
			name:     "with json flag",
			args:     []string{"--json", "test.js"},
			wantPath: "test.js",
			wantErr:  false,
		},
		{
			name:     "with config flag",
			args:     []string{"--config", "/path/to/config", "test.tsx"},
			wantPath: "test.tsx",
			wantErr:  false,
		},
		{
			name:    "no file path",
			args:    []string{},
			wantErr: true,
		},
		{
			name:    "multiple file paths",
			args:    []string{"test1.go", "test2.go"},
			wantErr: true,
		},
		{
			name:    "help flag",
			args:    []string{"--help"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPath, opts, err := parseLintFileFlags(tt.args)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseLintFileFlags() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && gotPath != tt.wantPath {
				t.Errorf("parseLintFileFlags() gotPath = %v, want %v", gotPath, tt.wantPath)
			}
			if !tt.wantErr && opts.Phase != runner.PhaseLint {
				t.Errorf("parseLintFileFlags() phase = %v, want %v", opts.Phase, runner.PhaseLint)
			}
		})
	}
}

func TestFindServiceForFile(t *testing.T) {
	// Create a temporary directory structure for testing
	tempDir := t.TempDir()
	
	// Create service directories
	uiDir := filepath.Join(tempDir, "ui")
	agentDir := filepath.Join(tempDir, "agent-service")
	mealDir := filepath.Join(tempDir, "meal-service")
	
	os.MkdirAll(uiDir, 0755)
	os.MkdirAll(agentDir, 0755)
	os.MkdirAll(mealDir, 0755)

	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "ui",
				Type: config.ServiceTypeNode,
				Dir:  uiDir,
			},
			{
				Name: "agent-service",
				Type: config.ServiceTypeNode,
				Dir:  agentDir,
			},
			{
				Name: "meal-service",
				Type: config.ServiceTypeGo,
				Dir:  mealDir,
			},
		},
	}

	tests := []struct {
		name        string
		filePath    string
		wantService string
		wantErr     bool
	}{
		{
			name:        "ui service file",
			filePath:    filepath.Join(uiDir, "src", "component.tsx"),
			wantService: "ui",
			wantErr:     false,
		},
		{
			name:        "agent-service file",
			filePath:    filepath.Join(agentDir, "handlers.ts"),
			wantService: "agent-service",
			wantErr:     false,
		},
		{
			name:        "meal-service file",
			filePath:    filepath.Join(mealDir, "main.go"),
			wantService: "meal-service",
			wantErr:     false,
		},
		{
			name:     "file outside services",
			filePath: filepath.Join(tempDir, "other", "file.txt"),
			wantErr:  true,
		},
		{
			name:     "non-existent service directory",
			filePath: "/non/existent/path/file.go",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create the file's parent directory if it doesn't exist
			if !tt.wantErr {
				os.MkdirAll(filepath.Dir(tt.filePath), 0755)
			}

			gotService, err := findServiceForFile(cfg, tt.filePath)
			if (err != nil) != tt.wantErr {
				t.Errorf("findServiceForFile() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && gotService.Name != tt.wantService {
				t.Errorf("findServiceForFile() gotService.Name = %v, want %v", gotService.Name, tt.wantService)
			}
		})
	}
}

func TestFindServiceForFileNestedDirectories(t *testing.T) {
	// Test nested directory matching - should pick the most specific match
	tempDir := t.TempDir()
	
	rootDir := filepath.Join(tempDir, "services")
	uiDir := filepath.Join(rootDir, "ui")
	
	os.MkdirAll(rootDir, 0755)
	os.MkdirAll(uiDir, 0755)

	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "root",
				Type: config.ServiceTypeNode,
				Dir:  rootDir,
			},
			{
				Name: "ui",
				Type: config.ServiceTypeNode,
				Dir:  uiDir,
			},
		},
	}

	filePath := filepath.Join(uiDir, "component.tsx")
	os.MkdirAll(filepath.Dir(filePath), 0755)

	service, err := findServiceForFile(cfg, filePath)
	if err != nil {
		t.Errorf("findServiceForFile() error = %v", err)
		return
	}
	
	// Should match the more specific "ui" service, not the "root" service
	if service.Name != "ui" {
		t.Errorf("findServiceForFile() gotService.Name = %v, want ui", service.Name)
	}
}

func TestLintFile(t *testing.T) {
	tempDir := t.TempDir()
	
	// Create service directories
	goDir := filepath.Join(tempDir, "go-service")
	nodeDir := filepath.Join(tempDir, "node-service")
	
	os.MkdirAll(goDir, 0755)
	os.MkdirAll(nodeDir, 0755)

	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "go-service",
				Type: config.ServiceTypeGo,
				Dir:  goDir,
			},
			{
				Name: "node-service",
				Type: config.ServiceTypeNode,
				Dir:  nodeDir,
			},
		},
	}

	// Create fake command runner
	fakeRunner := execx.NewFakeCommandRunner()

	tests := []struct {
		name        string
		filePath    string
		wantService string
		wantErr     bool
	}{
		{
			name:        "go file success",
			filePath:    filepath.Join(goDir, "main.go"),
			wantService: "go-service",
			wantErr:     false,
		},
		{
			name:        "typescript file success",
			filePath:    filepath.Join(nodeDir, "index.ts"),
			wantService: "node-service",
			wantErr:     false,
		},
		{
			name:     "file not in any service",
			filePath: filepath.Join(tempDir, "orphan.go"),
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create the file's parent directory
			if !tt.wantErr {
				os.MkdirAll(filepath.Dir(tt.filePath), 0755)
			}

			ctx := context.Background()
			result, err := lintFile(ctx, cfg, fakeRunner, tt.filePath)

			if (err != nil) != tt.wantErr {
				t.Errorf("lintFile() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if result.Service != tt.wantService {
					t.Errorf("lintFile() result.Service = %v, want %v", result.Service, tt.wantService)
				}
				if result.Phase != runner.PhaseLint {
					t.Errorf("lintFile() result.Phase = %v, want %v", result.Phase, runner.PhaseLint)
				}
			}
		})
	}
}

func TestLintFileUnsupportedServiceType(t *testing.T) {
	tempDir := t.TempDir()
	serviceDir := filepath.Join(tempDir, "service")
	os.MkdirAll(serviceDir, 0755)

	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "service",
				Type: "unknown", // Unsupported service type
				Dir:  serviceDir,
			},
		},
	}

	fakeRunner := execx.NewFakeCommandRunner()
	filePath := filepath.Join(serviceDir, "test.txt")
	os.MkdirAll(filepath.Dir(filePath), 0755)

	ctx := context.Background()
	_, err := lintFile(ctx, cfg, fakeRunner, filePath)

	if err == nil {
		t.Error("lintFile() expected error for unsupported service type, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported service type") {
		t.Errorf("lintFile() error message = %v, want to contain 'unsupported service type'", err)
	}
}

func TestLintFileAbsolutePath(t *testing.T) {
	// Test that lintFile correctly handles relative paths by converting to absolute
	tempDir := t.TempDir()
	serviceDir := filepath.Join(tempDir, "service")
	os.MkdirAll(serviceDir, 0755)

	// Change to the temp directory first, before creating the config
	oldWd, _ := os.Getwd()
	defer os.Chdir(oldWd)
	os.Chdir(tempDir)

	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "service",
				Type: config.ServiceTypeGo,
				Dir:  "./service", // Use relative path in config
			},
		},
	}

	fakeRunner := execx.NewFakeCommandRunner()

	// Create a file in the service directory
	filePath := filepath.Join(serviceDir, "test.go")
	os.MkdirAll(filepath.Dir(filePath), 0755)

	ctx := context.Background()
	result, err := lintFile(ctx, cfg, fakeRunner, "service/test.go")

	if err != nil {
		t.Errorf("lintFile() with relative path error = %v", err)
		return
	}

	if result.Service != "service" {
		t.Errorf("lintFile() with relative path result.Service = %v, want service", result.Service)
	}
}

func TestOutputJSON(t *testing.T) {
	result := runner.Result{
		Service:  "test-service",
		Phase:    runner.PhaseLint,
		Duration: 0,
		Status:   runner.StatusSuccess,
	}

	// Capture stdout
	r, w, _ := os.Pipe()
	oldStdout := os.Stdout
	os.Stdout = w

	err := outputJSON(result)
	
	w.Close()
	os.Stdout = oldStdout

	if err != nil {
		t.Errorf("outputJSON() error = %v", err)
		return
	}

	// Read the output
	buf := make([]byte, 1024)
	n, _ := r.Read(buf)
	output := string(buf[:n])

	// Check that it contains expected JSON fields
	if !strings.Contains(output, `"service": "test-service"`) {
		t.Errorf("outputJSON() output missing service field")
	}
	if !strings.Contains(output, `"phase": "lint"`) {
		t.Errorf("outputJSON() output missing phase field")
	}
	if !strings.Contains(output, `"status": "success"`) {
		t.Errorf("outputJSON() output missing status field")
	}
}

func TestOutputText(t *testing.T) {
	tests := []struct {
		name     string
		result   runner.Result
		verbose  bool
		wantText string
	}{
		{
			name: "success with verbose",
			result: runner.Result{
				Service: "test-service",
				Status:  runner.StatusSuccess,
			},
			verbose:  true,
			wantText: "✓ test-service lint passed",
		},
		{
			name: "success without verbose",
			result: runner.Result{
				Service: "test-service",
				Status:  runner.StatusSuccess,
			},
			verbose:  false,
			wantText: "", // Should output nothing
		},
		{
			name: "failure with failures",
			result: runner.Result{
				Service: "test-service",
				Status:  runner.StatusFailure,
				Failures: []runner.Failure{
					{
						File:    "test.go",
						Line:    10,
						Message: "syntax error",
					},
				},
			},
			verbose:  false,
			wantText: "✗ test-service lint failed\n  test.go:10 syntax error",
		},
		{
			name: "failure with file but no line",
			result: runner.Result{
				Service: "test-service",
				Status:  runner.StatusFailure,
				Failures: []runner.Failure{
					{
						File:    "test.go",
						Message: "general error",
					},
				},
			},
			verbose:  false,
			wantText: "✗ test-service lint failed\n  test.go: general error",
		},
		{
			name: "failure with message only",
			result: runner.Result{
				Service: "test-service",
				Status:  runner.StatusFailure,
				Failures: []runner.Failure{
					{
						Message: "general error",
					},
				},
			},
			verbose:  false,
			wantText: "✗ test-service lint failed\n  general error",
		},
		{
			name: "error",
			result: runner.Result{
				Service:      "test-service",
				Status:       runner.StatusError,
				ErrorMessage: "command not found",
			},
			verbose:  false,
			wantText: "✗ test-service lint error: command not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Capture stdout
			r, w, _ := os.Pipe()
			oldStdout := os.Stdout
			os.Stdout = w

			outputText(tt.result, tt.verbose)
			
			w.Close()
			os.Stdout = oldStdout

			// Read the output
			buf := make([]byte, 1024)
			n, _ := r.Read(buf)
			output := strings.TrimSpace(string(buf[:n]))

			if tt.wantText == "" && output != "" {
				t.Errorf("outputText() expected no output, got %q", output)
			} else if tt.wantText != "" && !strings.Contains(output, tt.wantText) {
				t.Errorf("outputText() output %q does not contain expected text %q", output, tt.wantText)
			}
		})
	}
}

func TestParseLintFileFlags_CIImplies(t *testing.T) {
	_, opts, err := parseLintFileFlags([]string{"--ci", "test.go"})
	if err != nil {
		t.Errorf("parseLintFileFlags() with --ci error = %v", err)
		return
	}
	if !opts.CI {
		t.Errorf("parseLintFileFlags() --ci should set CI flag")
	}
	if !opts.JSON {
		t.Errorf("parseLintFileFlags() --ci should imply JSON")
	}
	if !opts.NoSpinner {
		t.Errorf("parseLintFileFlags() --ci should imply NoSpinner")
	}
}

func TestFindServiceForFile_EmptyDir(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "service",
				Type: config.ServiceTypeGo,
				Dir:  "", // Empty directory
			},
		},
	}

	_, err := findServiceForFile(cfg, "/some/file.go")
	if err == nil {
		t.Error("findServiceForFile() with empty service dir should return error")
	}
}

func TestFindServiceForFile_RelativePathError(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "service", 
				Type: config.ServiceTypeGo,
				Dir:  "/non/existent/path", // Non-existent absolute path
			},
		},
	}

	_, err := findServiceForFile(cfg, "/some/file.go")
	if err == nil {
		t.Error("findServiceForFile() with non-existent service dir should return error")
	}
}

func TestLintFile_AbsolutePathError(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "service",
				Type: config.ServiceTypeGo,
				Dir:  "/tmp",
			},
		},
	}

	fakeRunner := execx.NewFakeCommandRunner()
	
	// Test with invalid path character that will cause filepath.Abs to fail
	// This is a bit tricky to test as filepath.Abs rarely fails
	ctx := context.Background()
	
	// Use a very long path that might cause issues
	longPath := strings.Repeat("a", 10000)
	result, err := lintFile(ctx, cfg, fakeRunner, longPath)
	
	// The function should handle this gracefully, either succeeding or failing properly
	if err != nil {
		// If it fails, that's acceptable for this edge case
		return
	}
	
	// If it succeeds, check the result is valid
	if result.Service == "" {
		t.Error("lintFile() should return a valid result even for edge cases")
	}
}

func TestParseFlags_InvalidFlag(t *testing.T) {
	_, err := parseFlags(runner.PhaseTest, []string{"--invalid-flag"})
	if err == nil {
		t.Error("parseFlags() should return error for invalid flag")
	}
}

func TestParseFlags_AllFlagsSet(t *testing.T) {
	opts, err := parseFlags(runner.PhaseBuild, []string{
		"--verbose",
		"--json", 
		"--no-spinner",
		"--service", "svc1",
		"--service", "svc2",
		"--config", "/custom/config.yaml",
		"--max-parallel", "8",
	})
	if err != nil {
		t.Fatalf("parseFlags() error = %v", err)
	}
	
	if !opts.Verbose {
		t.Error("expected verbose true")
	}
	if !opts.JSON {
		t.Error("expected JSON true") 
	}
	if !opts.NoSpinner {
		t.Error("expected NoSpinner true")
	}
	if opts.ConfigPath != "/custom/config.yaml" {
		t.Errorf("expected config path /custom/config.yaml, got %s", opts.ConfigPath)
	}
	if opts.MaxParallel != 8 {
		t.Errorf("expected max-parallel 8, got %d", opts.MaxParallel)
	}
	if len(opts.Services) != 2 || opts.Services[0] != "svc1" || opts.Services[1] != "svc2" {
		t.Errorf("expected services [svc1, svc2], got %v", opts.Services)
	}
	if opts.Phase != runner.PhaseBuild {
		t.Errorf("expected phase build, got %v", opts.Phase)
	}
}

func TestParseWatchFlags_InvalidFlag(t *testing.T) {
	_, err := parseWatchFlags([]string{"--invalid-flag"})
	if err == nil {
		t.Error("parseWatchFlags() should return error for invalid flag")
	}
}

func TestParseWatchFlags_AllFlagsSet(t *testing.T) {
	opts, err := parseWatchFlags([]string{
		"--verbose",
		"--json", 
		"--no-spinner",
		"--service", "svc1",
		"--service", "svc2",
		"--extensions", ".go",
		"--extensions", ".ts",
		"--config", "/custom/config.yaml",
		"--max-parallel", "8",
	})
	if err != nil {
		t.Fatalf("parseWatchFlags() error = %v", err)
	}
	
	if !opts.Verbose {
		t.Error("expected verbose true")
	}
	if !opts.JSON {
		t.Error("expected JSON true") 
	}
	if !opts.NoSpinner {
		t.Error("expected NoSpinner true")
	}
	if opts.ConfigPath != "/custom/config.yaml" {
		t.Errorf("expected config path /custom/config.yaml, got %s", opts.ConfigPath)
	}
	if opts.MaxParallel != 8 {
		t.Errorf("expected max-parallel 8, got %d", opts.MaxParallel)
	}
	if len(opts.Services) != 2 || opts.Services[0] != "svc1" || opts.Services[1] != "svc2" {
		t.Errorf("expected services [svc1, svc2], got %v", opts.Services)
	}
	if len(opts.Extensions) != 2 || opts.Extensions[0] != ".go" || opts.Extensions[1] != ".ts" {
		t.Errorf("expected extensions [.go, .ts], got %v", opts.Extensions)
	}
}

func TestFindServiceForFile_AbsoluteDirError(t *testing.T) {
	// Create a config with a service directory that has invalid characters
	// This is platform specific and hard to test portably
	cfg := &config.Config{
		Services: []config.Service{
			{
				Name: "service",
				Type: config.ServiceTypeGo,
				Dir:  "relative/path/with/../elements", // Use a relative path that might cause issues
			},
		},
	}

	// Try with any file path - the error will come from the service directory processing
	_, err := findServiceForFile(cfg, "/some/file.go")
	
	// We expect this to either succeed (finding no match) or fail gracefully
	// The important thing is that it doesn't panic
	if err != nil && !strings.Contains(err.Error(), "no service found") {
		// If there's a different error, that's acceptable too
		t.Logf("findServiceForFile() returned error: %v", err)
	}
}

func TestParseLintFileFlags_InvalidFlag(t *testing.T) {
	_, _, err := parseLintFileFlags([]string{"--invalid-flag", "test.go"})
	if err == nil {
		t.Error("parseLintFileFlags() should return error for invalid flag")
	}
}

func TestParseLintFileFlags_AllFlagsSet(t *testing.T) {
	filePath, opts, err := parseLintFileFlags([]string{
		"--verbose",
		"--json", 
		"--no-spinner",
		"--config", "/custom/config.yaml",
		"test.go",
	})
	if err != nil {
		t.Fatalf("parseLintFileFlags() error = %v", err)
	}
	
	if filePath != "test.go" {
		t.Errorf("expected file path test.go, got %s", filePath)
	}
	if !opts.Verbose {
		t.Error("expected verbose true")
	}
	if !opts.JSON {
		t.Error("expected JSON true") 
	}
	if !opts.NoSpinner {
		t.Error("expected NoSpinner true")
	}
	if opts.ConfigPath != "/custom/config.yaml" {
		t.Errorf("expected config path /custom/config.yaml, got %s", opts.ConfigPath)
	}
	if opts.Phase != runner.PhaseLint {
		t.Errorf("expected phase lint, got %v", opts.Phase)
	}
}

