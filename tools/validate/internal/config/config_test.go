package config

import (
	"testing"

	"github.com/bradcarter-meal-planner/tools/validate/internal/testutil"
)

func TestLoader_Load_Success(t *testing.T) {
	tmpDir := testutil.TempDir(t)

	configContent := `services:
  - name: ui
    type: node
    test: "yarn test --silent"
    lint: "yarn lint --quiet"
    build: "yarn build"
  - name: core
    type: go
    dir: "./go/core"
    test:
      cmd: "go test ./... -cover -json"
      coverage_profile: "coverage.out"
    lint:
      cmd: "golangci-lint run --out-format json"
    build:
      cmd: "go build ./..."
    min_coverage: 80
`

	configPath := testutil.WriteFile(t, tmpDir, ".validate.yaml", configContent)

	loader := NewLoader(configPath)
	config, err := loader.Load()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(config.Services) != 2 {
		t.Errorf("Expected 2 services, got %d", len(config.Services))
	}

	// Check first service (ui)
	ui := config.Services[0]
	if ui.Name != "ui" {
		t.Errorf("Expected name 'ui', got %q", ui.Name)
	}
	if ui.Type != ServiceTypeNode {
		t.Errorf("Expected type 'node', got %q", ui.Type)
	}
	if ui.GetTestCommand() != "yarn test --silent" {
		t.Errorf("Expected test cmd 'yarn test --silent', got %q", ui.GetTestCommand())
	}

	// Check second service (core)
	core := config.Services[1]
	if core.Name != "core" {
		t.Errorf("Expected name 'core', got %q", core.Name)
	}
	if core.Type != ServiceTypeGo {
		t.Errorf("Expected type 'go', got %q", core.Type)
	}
	if core.Dir != "./go/core" {
		t.Errorf("Expected dir './go/core', got %q", core.Dir)
	}
	if core.GetTestCommandStruct().CoverageProfile != "coverage.out" {
		t.Errorf("Expected coverage_profile 'coverage.out', got %q", core.GetTestCommandStruct().CoverageProfile)
	}
	if core.MinCoverage != 80 {
		t.Errorf("Expected min_coverage 80, got %d", core.MinCoverage)
	}
}

func TestLoader_Load_DefaultPath(t *testing.T) {
	tmpDir := testutil.TempDir(t)

	configContent := `services:
  - name: test-service
    type: go
    test: "go test ./..."
`

	// Write to default path in temp directory
	testutil.WriteFile(t, tmpDir, ".validate.yaml", configContent)

	// Change to temp directory
	oldWd := testutil.ChangeWorkingDir(t, tmpDir)
	defer testutil.ChangeWorkingDir(t, oldWd)

	loader := NewLoader("")
	config, err := loader.Load()

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(config.Services) != 1 {
		t.Errorf("Expected 1 service, got %d", len(config.Services))
	}
}

func TestLoader_Load_FileNotFound(t *testing.T) {
	loader := NewLoader("/nonexistent/config.yaml")
	_, err := loader.Load()

	if err == nil {
		t.Fatal("Expected error for non-existent file")
	}
}

func TestLoader_Load_InvalidYAML(t *testing.T) {
	tmpDir := testutil.TempDir(t)

	invalidYAML := `services:
  - name: test
    type: go
    invalid: [unclosed bracket
`

	configPath := testutil.WriteFile(t, tmpDir, "invalid.yaml", invalidYAML)

	loader := NewLoader(configPath)
	_, err := loader.Load()

	if err == nil {
		t.Fatal("Expected error for invalid YAML")
	}
}

func TestValidateConfig_NoServices(t *testing.T) {
	loader := NewLoader("")
	config := &Config{}

	err := loader.validateConfig(config)
	if err == nil {
		t.Fatal("Expected error for config with no services")
	}
}

func TestValidateConfig_NoServiceName(t *testing.T) {
	loader := NewLoader("")
	config := &Config{
		Services: []Service{
			{Type: ServiceTypeGo, Test: "go test"},
		},
	}

	err := loader.validateConfig(config)
	if err == nil {
		t.Fatal("Expected error for service with no name")
	}
}

func TestValidateConfig_DuplicateServiceNames(t *testing.T) {
	loader := NewLoader("")
	config := &Config{
		Services: []Service{
			{Name: "test", Type: ServiceTypeGo, Test: "go test"},
			{Name: "test", Type: ServiceTypeNode, Test: "npm test"},
		},
	}

	err := loader.validateConfig(config)
	if err == nil {
		t.Fatal("Expected error for duplicate service names")
	}
}

func TestValidateConfig_InvalidServiceType(t *testing.T) {
	loader := NewLoader("")
	config := &Config{
		Services: []Service{
			{Name: "test", Type: "invalid", Test: "test"},
		},
	}

	err := loader.validateConfig(config)
	if err == nil {
		t.Fatal("Expected error for invalid service type")
	}
}

func TestValidateConfig_NoCommands(t *testing.T) {
	loader := NewLoader("")
	config := &Config{
		Services: []Service{
			{Name: "test", Type: ServiceTypeGo},
		},
	}

	err := loader.validateConfig(config)
	if err == nil {
		t.Fatal("Expected error for service with no commands")
	}
}

func TestValidateConfig_InvalidCoverage(t *testing.T) {
	loader := NewLoader("")

	testCases := []int{-1, 101}
	for _, coverage := range testCases {
		config := &Config{
			Services: []Service{
				{Name: "test", Type: ServiceTypeGo, Test: "go test", MinCoverage: coverage},
			},
		}

		err := loader.validateConfig(config)
		if err == nil {
			t.Errorf("Expected error for invalid coverage %d", coverage)
		}
	}
}

func TestConfig_GetService(t *testing.T) {
	config := &Config{
		Services: []Service{
			{Name: "ui", Type: ServiceTypeNode},
			{Name: "core", Type: ServiceTypeGo},
		},
	}

	// Test existing service
	service := config.GetService("ui")
	if service == nil {
		t.Fatal("Expected to find service 'ui'")
	}
	if service.Name != "ui" {
		t.Errorf("Expected name 'ui', got %q", service.Name)
	}

	// Test non-existent service
	service = config.GetService("nonexistent")
	if service != nil {
		t.Error("Expected nil for non-existent service")
	}
}

func TestConfig_ServiceNames(t *testing.T) {
	config := &Config{
		Services: []Service{
			{Name: "ui"},
			{Name: "core"},
			{Name: "api"},
		},
	}

	names := config.ServiceNames()
	expected := []string{"ui", "core", "api"}

	if len(names) != len(expected) {
		t.Errorf("Expected %d names, got %d", len(expected), len(names))
	}

	for i, name := range names {
		if name != expected[i] {
			t.Errorf("Expected name %q at index %d, got %q", expected[i], i, name)
		}
	}
}

func TestConfig_FilterServices(t *testing.T) {
	config := &Config{
		Services: []Service{
			{Name: "ui", Type: ServiceTypeNode},
			{Name: "core", Type: ServiceTypeGo},
			{Name: "api", Type: ServiceTypeGo},
		},
	}

	// Test filtering
	filtered := config.FilterServices([]string{"ui", "api"})
	if len(filtered.Services) != 2 {
		t.Errorf("Expected 2 filtered services, got %d", len(filtered.Services))
	}

	// Check order is preserved
	if filtered.Services[0].Name != "ui" || filtered.Services[1].Name != "api" {
		t.Error("Service order not preserved in filtering")
	}

	// Test empty filter (should return original)
	filtered = config.FilterServices([]string{})
	if len(filtered.Services) != 3 {
		t.Errorf("Expected 3 services with empty filter, got %d", len(filtered.Services))
	}

	// Test non-existent service name
	filtered = config.FilterServices([]string{"nonexistent"})
	if len(filtered.Services) != 0 {
		t.Errorf("Expected 0 services for non-existent filter, got %d", len(filtered.Services))
	}
}

func TestIsRelativePath(t *testing.T) {
	testCases := []struct {
		path     string
		expected bool
	}{
		{".", true},
		{"..", true},
		{"./foo", true},
		{"../foo", true},
		{"/absolute", false},
		{"foo", false},
		{"", false},
	}

	for _, tc := range testCases {
		result := isRelativePath(tc.path)
		if result != tc.expected {
			t.Errorf("isRelativePath(%q) = %v, expected %v", tc.path, result, tc.expected)
		}
	}
}
