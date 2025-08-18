package watcher

import (
	"testing"
	
	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
)

func TestNewFileMatcher(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{Name: "ui", Type: "node", Dir: "./ui"},
		},
	}

	t.Run("default extensions", func(t *testing.T) {
		matcher := NewFileMatcher(cfg, nil)
		
		extensions := matcher.GetWatchedExtensions()
		expectedExts := []string{".go", ".ts", ".tsx", ".js", ".jsx"}
		
		if len(extensions) != len(expectedExts) {
			t.Fatalf("expected %d extensions, got %d", len(expectedExts), len(extensions))
		}
		
		extMap := make(map[string]bool)
		for _, ext := range extensions {
			extMap[ext] = true
		}
		
		for _, expected := range expectedExts {
			if !extMap[expected] {
				t.Errorf("expected extension %s not found", expected)
			}
		}
	})

	t.Run("custom extensions", func(t *testing.T) {
		customExts := []string{".py", ".rb", "yaml"}
		matcher := NewFileMatcher(cfg, customExts)
		
		extensions := matcher.GetWatchedExtensions()
		
		if len(extensions) != 3 {
			t.Fatalf("expected 3 extensions, got %d", len(extensions))
		}
		
		extMap := make(map[string]bool)
		for _, ext := range extensions {
			extMap[ext] = true
		}
		
		expectedExts := []string{".py", ".rb", ".yaml"}
		for _, expected := range expectedExts {
			if !extMap[expected] {
				t.Errorf("expected extension %s not found", expected)
			}
		}
	})
}

func TestFileMatcher_ShouldWatch(t *testing.T) {
	cfg := &config.Config{}
	matcher := NewFileMatcher(cfg, []string{".go", ".ts"})

	testCases := []struct {
		filePath string
		expected bool
	}{
		{"main.go", true},
		{"service.ts", true},
		{"component.tsx", false},
		{"README.md", false},
		{"config.json", false},
		{"/path/to/file.go", true},
		{"/path/to/File.TS", true}, // case insensitive
	}

	for _, tc := range testCases {
		t.Run(tc.filePath, func(t *testing.T) {
			result := matcher.ShouldWatch(tc.filePath)
			if result != tc.expected {
				t.Errorf("ShouldWatch(%s) = %v, expected %v", tc.filePath, result, tc.expected)
			}
		})
	}
}

func TestFileMatcher_FindMatchingService(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{Name: "ui", Type: "node", Dir: "./ui"},
			{Name: "api", Type: "go", Dir: "./api-service"},
		},
	}
	matcher := NewFileMatcher(cfg, nil)

	testCases := []struct {
		name         string
		filePath     string
		expectedName string
		shouldMatch  bool
	}{
		{
			name:         "ui service file",
			filePath:     "./ui/src/main.ts",
			expectedName: "ui",
			shouldMatch:  true,
		},
		{
			name:         "api service file",
			filePath:     "./api-service/main.go",
			expectedName: "api",
			shouldMatch:  true,
		},
		{
			name:         "nested ui file",
			filePath:     "./ui/src/components/Button.tsx",
			expectedName: "ui",
			shouldMatch:  true,
		},
		{
			name:         "file outside services",
			filePath:     "./README.md",
			expectedName: "",
			shouldMatch:  false,
		},
		{
			name:         "file in different directory",
			filePath:     "./docs/guide.md",
			expectedName: "",
			shouldMatch:  false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			serviceName, service := matcher.FindMatchingService(tc.filePath)
			
			if tc.shouldMatch {
				if serviceName != tc.expectedName {
					t.Errorf("expected service name %s, got %s", tc.expectedName, serviceName)
				}
				if service == nil {
					t.Error("expected service to be non-nil")
				} else if service.Name != tc.expectedName {
					t.Errorf("expected service.Name %s, got %s", tc.expectedName, service.Name)
				}
			} else {
				if serviceName != "" {
					t.Errorf("expected no matching service, got %s", serviceName)
				}
				if service != nil {
					t.Error("expected service to be nil")
				}
			}
		})
	}
}

func TestFileMatcher_FindMatchingService_EmptyDir(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{Name: "nodir", Type: "node", Dir: ""}, // Empty dir should be skipped
			{Name: "ui", Type: "node", Dir: "./ui"},
		},
	}
	matcher := NewFileMatcher(cfg, nil)

	serviceName, service := matcher.FindMatchingService("./ui/main.ts")
	if serviceName != "ui" {
		t.Errorf("expected service name 'ui', got %s", serviceName)
	}
	if service == nil || service.Name != "ui" {
		t.Error("expected ui service to be found")
	}
}