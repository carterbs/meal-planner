package runner

import (
	"testing"
	"time"
)

func TestPhase_String(t *testing.T) {
	tests := []struct {
		phase    Phase
		expected string
	}{
		{PhaseTest, "test"},
		{PhaseLint, "lint"},
		{PhaseBuild, "build"},
		{Phase("custom"), "custom"},
	}

	for _, tt := range tests {
		t.Run(string(tt.phase), func(t *testing.T) {
			result := tt.phase.String()
			if result != tt.expected {
				t.Errorf("Phase.String() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestStatus_String(t *testing.T) {
	tests := []struct {
		status   Status
		expected string
	}{
		{StatusSuccess, "success"},
		{StatusFailure, "failure"},
		{StatusError, "error"},
		{Status("custom"), "custom"},
	}

	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			result := tt.status.String()
			if result != tt.expected {
				t.Errorf("Status.String() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestResult_IsSuccess(t *testing.T) {
	tests := []struct {
		name     string
		result   Result
		expected bool
	}{
		{
			name:     "success status",
			result:   Result{Status: StatusSuccess},
			expected: true,
		},
		{
			name:     "failure status",
			result:   Result{Status: StatusFailure},
			expected: false,
		},
		{
			name:     "error status",
			result:   Result{Status: StatusError},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.result.IsSuccess()
			if result != tt.expected {
				t.Errorf("Result.IsSuccess() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestResult_HasFailures(t *testing.T) {
	tests := []struct {
		name     string
		result   Result
		expected bool
	}{
		{
			name:     "no failures",
			result:   Result{},
			expected: false,
		},
		{
			name: "with failures",
			result: Result{
				Failures: []Failure{
					{Message: "test failure"},
				},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.result.HasFailures()
			if result != tt.expected {
				t.Errorf("Result.HasFailures() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestResult_TotalTests(t *testing.T) {
	tests := []struct {
		name     string
		result   Result
		expected int
	}{
		{
			name:     "no tests",
			result:   Result{},
			expected: 0,
		},
		{
			name: "passed only",
			result: Result{
				PassedCount: 5,
			},
			expected: 5,
		},
		{
			name: "failed only",
			result: Result{
				FailedCount: 3,
			},
			expected: 3,
		},
		{
			name: "passed and failed",
			result: Result{
				PassedCount: 10,
				FailedCount: 2,
			},
			expected: 12,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.result.TotalTests()
			if result != tt.expected {
				t.Errorf("Result.TotalTests() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestFailure(t *testing.T) {
	// Test basic failure creation
	failure := Failure{
		File:    "test.go",
		Line:    42,
		Message: "assertion failed",
		Type:    "test",
	}

	if failure.File != "test.go" {
		t.Errorf("Expected File = 'test.go', got %v", failure.File)
	}
	if failure.Line != 42 {
		t.Errorf("Expected Line = 42, got %v", failure.Line)
	}
	if failure.Message != "assertion failed" {
		t.Errorf("Expected Message = 'assertion failed', got %v", failure.Message)
	}
	if failure.Type != "test" {
		t.Errorf("Expected Type = 'test', got %v", failure.Type)
	}
}

func TestCoverage(t *testing.T) {
	// Test basic coverage creation
	coverage := Coverage{
		Percentage: 85.5,
		Covered:    171,
		Total:      200,
		Details: map[string]FileCoverage{
			"file1.go": {
				Percentage: 90.0,
				Covered:    90,
				Total:      100,
			},
			"file2.go": {
				Percentage: 80.0,
				Covered:    80,
				Total:      100,
			},
		},
	}

	if coverage.Percentage != 85.5 {
		t.Errorf("Expected Percentage = 85.5, got %v", coverage.Percentage)
	}
	if coverage.Covered != 171 {
		t.Errorf("Expected Covered = 171, got %v", coverage.Covered)
	}
	if coverage.Total != 200 {
		t.Errorf("Expected Total = 200, got %v", coverage.Total)
	}
	if len(coverage.Details) != 2 {
		t.Errorf("Expected 2 file details, got %v", len(coverage.Details))
	}

	file1 := coverage.Details["file1.go"]
	if file1.Percentage != 90.0 {
		t.Errorf("Expected file1.go percentage = 90.0, got %v", file1.Percentage)
	}
}

func TestFileCoverage(t *testing.T) {
	// Test basic file coverage creation
	fileCoverage := FileCoverage{
		Percentage: 75.0,
		Covered:    75,
		Total:      100,
	}

	if fileCoverage.Percentage != 75.0 {
		t.Errorf("Expected Percentage = 75.0, got %v", fileCoverage.Percentage)
	}
	if fileCoverage.Covered != 75 {
		t.Errorf("Expected Covered = 75, got %v", fileCoverage.Covered)
	}
	if fileCoverage.Total != 100 {
		t.Errorf("Expected Total = 100, got %v", fileCoverage.Total)
	}
}

func TestResult(t *testing.T) {
	// Test complete result creation
	duration := 2*time.Second + 500*time.Millisecond
	result := Result{
		Service:  "test-service",
		Phase:    PhaseTest,
		Duration: duration,
		Status:   StatusSuccess,
		Coverage: &Coverage{
			Percentage: 92.5,
			Covered:    185,
			Total:      200,
		},
		Failures: []Failure{
			{
				File:    "test.go",
				Line:    10,
				Message: "test failed",
				Type:    "test",
			},
		},
		PassedCount:  45,
		FailedCount:  2,
		WarningCount: 1,
	}

	if result.Service != "test-service" {
		t.Errorf("Expected Service = 'test-service', got %v", result.Service)
	}
	if result.Phase != PhaseTest {
		t.Errorf("Expected Phase = PhaseTest, got %v", result.Phase)
	}
	if result.Duration != duration {
		t.Errorf("Expected Duration = %v, got %v", duration, result.Duration)
	}
	if result.Status != StatusSuccess {
		t.Errorf("Expected Status = StatusSuccess, got %v", result.Status)
	}
	if result.Coverage == nil {
		t.Error("Expected Coverage to be non-nil")
	} else if result.Coverage.Percentage != 92.5 {
		t.Errorf("Expected Coverage.Percentage = 92.5, got %v", result.Coverage.Percentage)
	}
	if len(result.Failures) != 1 {
		t.Errorf("Expected 1 failure, got %v", len(result.Failures))
	}
	if result.PassedCount != 45 {
		t.Errorf("Expected PassedCount = 45, got %v", result.PassedCount)
	}
	if result.FailedCount != 2 {
		t.Errorf("Expected FailedCount = 2, got %v", result.FailedCount)
	}
	if result.WarningCount != 1 {
		t.Errorf("Expected WarningCount = 1, got %v", result.WarningCount)
	}
}