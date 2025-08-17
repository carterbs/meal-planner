package testutil

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTempDir(t *testing.T) {
	dir := TempDir(t)
	
	// Check that directory exists
	info, err := os.Stat(dir)
	if err != nil {
		t.Fatalf("Temp directory doesn't exist: %v", err)
	}
	
	if !info.IsDir() {
		t.Error("Expected temp path to be a directory")
	}
	
	// Directory should be cleaned up automatically by t.Cleanup
}

func TestWriteFile(t *testing.T) {
	dir := TempDir(t)
	content := "test content"
	
	path := WriteFile(t, dir, "test.txt", content)
	
	// Check file was created
	actualContent, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Failed to read written file: %v", err)
	}
	
	if string(actualContent) != content {
		t.Errorf("Expected content %q, got %q", content, string(actualContent))
	}
}

func TestMkdirAll(t *testing.T) {
	dir := TempDir(t)
	
	MkdirAll(t, dir, "sub1", "sub2/nested", "sub3")
	
	// Check directories were created
	paths := []string{
		filepath.Join(dir, "sub1"),
		filepath.Join(dir, "sub2", "nested"),
		filepath.Join(dir, "sub3"),
	}
	
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil {
			t.Errorf("Directory %s doesn't exist: %v", path, err)
			continue
		}
		
		if !info.IsDir() {
			t.Errorf("Expected %s to be a directory", path)
		}
	}
}

func TestGoldenFile(t *testing.T) {
	// Create a temporary directory for this test
	dir := TempDir(t)
	
	// Change to temp directory for test isolation
	oldWd, _ := os.Getwd()
	defer os.Chdir(oldWd)
	os.Chdir(dir)
	
	// Test golden file creation and update
	golden := NewGoldenFile(t, "test")
	content := []byte("test content")
	
	golden.Update(t, content)
	
	// Check file was created
	actualContent, err := os.ReadFile(golden.Path)
	if err != nil {
		t.Fatalf("Failed to read golden file: %v", err)
	}
	
	if string(actualContent) != string(content) {
		t.Errorf("Expected content %q, got %q", content, actualContent)
	}
	
	// Test comparison with matching content
	golden.Compare(t, content)
	
	// Test directory structure
	expectedDir := filepath.Join("testdata", t.Name())
	if !filepath.IsAbs(golden.Path) {
		expectedPath := filepath.Join(expectedDir, "test.golden")
		if golden.Path != expectedPath {
			t.Errorf("Expected path %s, got %s", expectedPath, golden.Path)
		}
	}
}