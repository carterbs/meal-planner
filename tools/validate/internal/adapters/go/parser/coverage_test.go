package parser

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseCoverageProfile_Success(t *testing.T) {
	// Create temporary coverage file
	tmpDir, err := os.MkdirTemp("", "coverage_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	coverageFile := filepath.Join(tmpDir, "coverage.out")
	coverageContent := `mode: set
github.com/test/pkg/main.go:10.2,12.3 2 1
github.com/test/pkg/main.go:12.3,15.4 3 0
github.com/test/pkg/utils.go:5.1,8.2 3 1
github.com/test/pkg/utils.go:10.1,12.2 2 1`

	err = os.WriteFile(coverageFile, []byte(coverageContent), 0644)
	if err != nil {
		t.Fatalf("Failed to write coverage file: %v", err)
	}

	result, err := ParseCoverageProfile(coverageFile)
	if err != nil {
		t.Fatalf("ParseCoverageProfile failed: %v", err)
	}

	// Check overall coverage: 7 covered out of 10 total = 70%
	expectedPercentage := 70.0
	if result.Percentage != expectedPercentage {
		t.Errorf("Expected percentage %.1f, got %.1f", expectedPercentage, result.Percentage)
	}
	if result.Covered != 7 {
		t.Errorf("Expected covered 7, got %d", result.Covered)
	}
	if result.Total != 10 {
		t.Errorf("Expected total 10, got %d", result.Total)
	}

	// Check per-file coverage
	if result.Details == nil {
		t.Error("Expected details to be set")
		return
	}

	mainFile := "github.com/test/pkg/main.go"
	if details, ok := result.Details[mainFile]; ok {
		// main.go: 2 covered out of 5 total = 40%
		if details.Percentage != 40.0 {
			t.Errorf("Expected main.go percentage 40.0, got %.1f", details.Percentage)
		}
		if details.Covered != 2 {
			t.Errorf("Expected main.go covered 2, got %d", details.Covered)
		}
		if details.Total != 5 {
			t.Errorf("Expected main.go total 5, got %d", details.Total)
		}
	} else {
		t.Errorf("Expected details for %s", mainFile)
	}

	utilsFile := "github.com/test/pkg/utils.go"
	if details, ok := result.Details[utilsFile]; ok {
		// utils.go: 5 covered out of 5 total = 100%
		if details.Percentage != 100.0 {
			t.Errorf("Expected utils.go percentage 100.0, got %.1f", details.Percentage)
		}
		if details.Covered != 5 {
			t.Errorf("Expected utils.go covered 5, got %d", details.Covered)
		}
		if details.Total != 5 {
			t.Errorf("Expected utils.go total 5, got %d", details.Total)
		}
	} else {
		t.Errorf("Expected details for %s", utilsFile)
	}
}

func TestParseCoverageProfile_FileNotFound(t *testing.T) {
	_, err := ParseCoverageProfile("/nonexistent/file.out")
	if err == nil {
		t.Error("Expected error for nonexistent file, got nil")
	}
}

func TestParseCoverageProfile_EmptyFile(t *testing.T) {
	// Create temporary empty coverage file
	tmpDir, err := os.MkdirTemp("", "coverage_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	coverageFile := filepath.Join(tmpDir, "coverage.out")
	err = os.WriteFile(coverageFile, []byte("mode: set\n"), 0644)
	if err != nil {
		t.Fatalf("Failed to write coverage file: %v", err)
	}

	result, err := ParseCoverageProfile(coverageFile)
	if err != nil {
		t.Fatalf("ParseCoverageProfile failed: %v", err)
	}

	if result.Percentage != 0 {
		t.Errorf("Expected percentage 0, got %.1f", result.Percentage)
	}
	if result.Covered != 0 {
		t.Errorf("Expected covered 0, got %d", result.Covered)
	}
	if result.Total != 0 {
		t.Errorf("Expected total 0, got %d", result.Total)
	}
	if len(result.Details) != 0 {
		t.Errorf("Expected no details, got %d entries", len(result.Details))
	}
}

func TestParseCoverageProfile_MalformedLines(t *testing.T) {
	// Create temporary coverage file with malformed lines
	tmpDir, err := os.MkdirTemp("", "coverage_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	coverageFile := filepath.Join(tmpDir, "coverage.out")
	coverageContent := `mode: set
github.com/test/pkg/main.go:10.2,12.3 2 1
invalid line without colon
github.com/test/pkg/main.go:15.1,17.2 abc 1
github.com/test/pkg/utils.go:5.1,8.2 3 xyz
github.com/test/pkg/utils.go:10.1,12.2 2 1`

	err = os.WriteFile(coverageFile, []byte(coverageContent), 0644)
	if err != nil {
		t.Fatalf("Failed to write coverage file: %v", err)
	}

	result, err := ParseCoverageProfile(coverageFile)
	if err != nil {
		t.Fatalf("ParseCoverageProfile failed: %v", err)
	}

	// Should skip malformed lines and parse valid ones
	// Valid lines: main.go:10.2,12.3 2 1 and utils.go:10.1,12.2 2 1 = 4 total, 4 covered
	if result.Percentage != 100.0 {
		t.Errorf("Expected percentage 100.0, got %.1f", result.Percentage)
	}
	if result.Covered != 4 {
		t.Errorf("Expected covered 4, got %d", result.Covered)
	}
	if result.Total != 4 {
		t.Errorf("Expected total 4, got %d", result.Total)
	}
}

func TestParseCoverageProfile_ZeroStatements(t *testing.T) {
	// Create temporary coverage file with zero statements for a file
	tmpDir, err := os.MkdirTemp("", "coverage_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	coverageFile := filepath.Join(tmpDir, "coverage.out")
	coverageContent := `mode: set
github.com/test/pkg/main.go:10.2,12.3 0 1
github.com/test/pkg/main.go:15.1,17.2 0 0`

	err = os.WriteFile(coverageFile, []byte(coverageContent), 0644)
	if err != nil {
		t.Fatalf("Failed to write coverage file: %v", err)
	}

	result, err := ParseCoverageProfile(coverageFile)
	if err != nil {
		t.Fatalf("ParseCoverageProfile failed: %v", err)
	}

	// No statements to cover
	if result.Percentage != 0 {
		t.Errorf("Expected percentage 0, got %.1f", result.Percentage)
	}
	if result.Covered != 0 {
		t.Errorf("Expected covered 0, got %d", result.Covered)
	}
	if result.Total != 0 {
		t.Errorf("Expected total 0, got %d", result.Total)
	}
}
