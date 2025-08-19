// Package testutil provides testing utilities and helpers.
package testutil

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// GoldenFile manages golden file testing.
type GoldenFile struct {
	Path string
}

// NewGoldenFile creates a new GoldenFile for the given test and name.
func NewGoldenFile(t *testing.T, name string) *GoldenFile {
	testDir := filepath.Join("testdata", t.Name())
	err := os.MkdirAll(testDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}

	return &GoldenFile{
		Path: filepath.Join(testDir, name+".golden"),
	}
}

// Update writes the given content to the golden file.
func (g *GoldenFile) Update(t *testing.T, content []byte) {
	err := os.WriteFile(g.Path, content, 0644)
	if err != nil {
		t.Fatalf("Failed to write golden file: %v", err)
	}
}

// Compare compares the given content with the golden file content.
func (g *GoldenFile) Compare(t *testing.T, actual []byte) {
	if os.Getenv("UPDATE_GOLDEN") == "1" {
		g.Update(t, actual)
		return
	}

	expected, err := os.ReadFile(g.Path)
	if err != nil {
		t.Fatalf("Failed to read golden file %s: %v", g.Path, err)
	}

	if !bytes.Equal(actual, expected) {
		t.Errorf("Content mismatch.\nExpected:\n%s\nActual:\n%s", expected, actual)
	}
}

// TempDir creates a temporary directory for testing.
func TempDir(t *testing.T) string {
	dir, err := os.MkdirTemp("", "validate-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	t.Cleanup(func() {
		os.RemoveAll(dir)
	})

	return dir
}

// WriteFile writes content to a file in the given directory.
func WriteFile(t *testing.T, dir, filename, content string) string {
	path := filepath.Join(dir, filename)
	err := os.WriteFile(path, []byte(content), 0644)
	if err != nil {
		t.Fatalf("Failed to write file %s: %v", path, err)
	}
	return path
}

// MkdirAll creates directories in the given base directory.
func MkdirAll(t *testing.T, base string, dirs ...string) {
	for _, dir := range dirs {
		path := filepath.Join(base, dir)
		err := os.MkdirAll(path, 0755)
		if err != nil {
			t.Fatalf("Failed to create directory %s: %v", path, err)
		}
	}
}

// ChangeWorkingDir changes the current working directory and returns the old one.
func ChangeWorkingDir(t *testing.T, dir string) string {
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Failed to get current working directory: %v", err)
	}

	err = os.Chdir(dir)
	if err != nil {
		t.Fatalf("Failed to change working directory to %s: %v", dir, err)
	}

	return oldWd
}
