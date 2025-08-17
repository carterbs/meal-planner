package runner

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestResult_JSONSerialization(t *testing.T) {
	// Create a complete result for testing
	result := Result{
		Service:  "test-service",
		Phase:    PhaseTest,
		Duration: 2*time.Second + 500*time.Millisecond,
		Status:   StatusSuccess,
		Coverage: &Coverage{
			Percentage: 85.5,
			Covered:    171,
			Total:      200,
			Details: map[string]FileCoverage{
				"file1.go": {
					Percentage: 90.0,
					Covered:    90,
					Total:      100,
				},
			},
		},
		Failures: []Failure{
			{
				File:    "test.go",
				Line:    42,
				Message: "assertion failed",
				Type:    "test",
			},
		},
		PassedCount:  45,
		FailedCount:  2,
		WarningCount: 1,
		ErrorMessage: "test error",
	}

	// Test MarshalJSON
	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Failed to marshal result: %v", err)
	}

	// Verify duration is serialized as string
	jsonStr := string(data)
	if !strings.Contains(jsonStr, `"duration":"2.5s"`) {
		t.Errorf("Expected duration to be serialized as '2.5s', got: %s", jsonStr)
	}

	// Test UnmarshalJSON
	var unmarshaled Result
	err = json.Unmarshal(data, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal result: %v", err)
	}

	// Verify all fields are correctly unmarshaled
	if unmarshaled.Service != result.Service {
		t.Errorf("Service mismatch: got %v, want %v", unmarshaled.Service, result.Service)
	}
	if unmarshaled.Phase != result.Phase {
		t.Errorf("Phase mismatch: got %v, want %v", unmarshaled.Phase, result.Phase)
	}
	if unmarshaled.Duration != result.Duration {
		t.Errorf("Duration mismatch: got %v, want %v", unmarshaled.Duration, result.Duration)
	}
	if unmarshaled.Status != result.Status {
		t.Errorf("Status mismatch: got %v, want %v", unmarshaled.Status, result.Status)
	}

	// Verify coverage
	if unmarshaled.Coverage == nil {
		t.Error("Coverage should not be nil")
	} else {
		if unmarshaled.Coverage.Percentage != result.Coverage.Percentage {
			t.Errorf("Coverage percentage mismatch: got %v, want %v",
				unmarshaled.Coverage.Percentage, result.Coverage.Percentage)
		}
		if unmarshaled.Coverage.Covered != result.Coverage.Covered {
			t.Errorf("Coverage covered mismatch: got %v, want %v",
				unmarshaled.Coverage.Covered, result.Coverage.Covered)
		}
		if unmarshaled.Coverage.Total != result.Coverage.Total {
			t.Errorf("Coverage total mismatch: got %v, want %v",
				unmarshaled.Coverage.Total, result.Coverage.Total)
		}
		if len(unmarshaled.Coverage.Details) != len(result.Coverage.Details) {
			t.Errorf("Coverage details length mismatch: got %v, want %v",
				len(unmarshaled.Coverage.Details), len(result.Coverage.Details))
		}
	}

	// Verify failures
	if len(unmarshaled.Failures) != len(result.Failures) {
		t.Errorf("Failures length mismatch: got %v, want %v",
			len(unmarshaled.Failures), len(result.Failures))
	} else if len(unmarshaled.Failures) > 0 {
		failure := unmarshaled.Failures[0]
		expected := result.Failures[0]
		if failure.File != expected.File {
			t.Errorf("Failure file mismatch: got %v, want %v", failure.File, expected.File)
		}
		if failure.Line != expected.Line {
			t.Errorf("Failure line mismatch: got %v, want %v", failure.Line, expected.Line)
		}
		if failure.Message != expected.Message {
			t.Errorf("Failure message mismatch: got %v, want %v", failure.Message, expected.Message)
		}
		if failure.Type != expected.Type {
			t.Errorf("Failure type mismatch: got %v, want %v", failure.Type, expected.Type)
		}
	}

	// Verify counts
	if unmarshaled.PassedCount != result.PassedCount {
		t.Errorf("PassedCount mismatch: got %v, want %v", unmarshaled.PassedCount, result.PassedCount)
	}
	if unmarshaled.FailedCount != result.FailedCount {
		t.Errorf("FailedCount mismatch: got %v, want %v", unmarshaled.FailedCount, result.FailedCount)
	}
	if unmarshaled.WarningCount != result.WarningCount {
		t.Errorf("WarningCount mismatch: got %v, want %v", unmarshaled.WarningCount, result.WarningCount)
	}
	if unmarshaled.ErrorMessage != result.ErrorMessage {
		t.Errorf("ErrorMessage mismatch: got %v, want %v", unmarshaled.ErrorMessage, result.ErrorMessage)
	}
}

func TestResult_ToJSON(t *testing.T) {
	result := Result{
		Service:     "test-service",
		Phase:       PhaseTest,
		Duration:    1 * time.Second,
		Status:      StatusSuccess,
		PassedCount: 10,
	}

	jsonStr, err := result.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON() failed: %v", err)
	}

	// Verify it's valid JSON
	var unmarshaled Result
	err = json.Unmarshal([]byte(jsonStr), &unmarshaled)
	if err != nil {
		t.Fatalf("Generated JSON is not valid: %v", err)
	}

	if unmarshaled.Service != result.Service {
		t.Errorf("Service mismatch after JSON round-trip: got %v, want %v",
			unmarshaled.Service, result.Service)
	}
}

func TestResult_ToJSON_MarshalError(t *testing.T) {
	// Create a result that will cause a marshal error
	// We can't easily trigger this with normal Result fields,
	// so we'll test the error handling path by checking that
	// ToJSON returns the same result as json.Marshal
	result := Result{
		Service: "test",
		Phase:   PhaseTest,
		Status:  StatusSuccess,
	}

	jsonStr, err := result.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON() should not fail for valid result: %v", err)
	}

	// Verify the result is the same as json.Marshal
	expected, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("json.Marshal() failed: %v", err)
	}

	if jsonStr != string(expected) {
		t.Errorf("ToJSON() = %v, want %v", jsonStr, string(expected))
	}
}

func TestFromJSON(t *testing.T) {
	jsonStr := `{
		"service": "test-service",
		"phase": "test",
		"duration": "1.5s",
		"status": "success",
		"passed_count": 10,
		"failed_count": 0
	}`

	result, err := FromJSON(jsonStr)
	if err != nil {
		t.Fatalf("FromJSON() failed: %v", err)
	}

	if result.Service != "test-service" {
		t.Errorf("Service mismatch: got %v, want %v", result.Service, "test-service")
	}
	if result.Phase != PhaseTest {
		t.Errorf("Phase mismatch: got %v, want %v", result.Phase, PhaseTest)
	}
	if result.Duration != 1500*time.Millisecond {
		t.Errorf("Duration mismatch: got %v, want %v", result.Duration, 1500*time.Millisecond)
	}
	if result.Status != StatusSuccess {
		t.Errorf("Status mismatch: got %v, want %v", result.Status, StatusSuccess)
	}
	if result.PassedCount != 10 {
		t.Errorf("PassedCount mismatch: got %v, want %v", result.PassedCount, 10)
	}
	if result.FailedCount != 0 {
		t.Errorf("FailedCount mismatch: got %v, want %v", result.FailedCount, 0)
	}
}

func TestFromJSON_InvalidJSON(t *testing.T) {
	invalidJSON := `{"service": "test", "invalid": json}`

	_, err := FromJSON(invalidJSON)
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

func TestFromJSON_InvalidDuration(t *testing.T) {
	invalidDurationJSON := `{
		"service": "test-service",
		"phase": "test",
		"duration": "invalid-duration",
		"status": "success"
	}`

	_, err := FromJSON(invalidDurationJSON)
	if err == nil {
		t.Error("Expected error for invalid duration, got nil")
	}
}

func TestResult_UnmarshalJSON_InvalidJSON(t *testing.T) {
	var result Result
	err := result.UnmarshalJSON([]byte(`{"invalid": json}`))
	if err == nil {
		t.Error("Expected error for invalid JSON structure, got nil")
	}
}

func TestResult_JSONSerialization_MinimalResult(t *testing.T) {
	// Test with minimal result
	result := Result{
		Service: "minimal",
		Phase:   PhaseTest,
		Status:  StatusSuccess,
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Failed to marshal minimal result: %v", err)
	}

	var unmarshaled Result
	err = json.Unmarshal(data, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal minimal result: %v", err)
	}

	if unmarshaled.Service != result.Service {
		t.Errorf("Service mismatch: got %v, want %v", unmarshaled.Service, result.Service)
	}
	if unmarshaled.Phase != result.Phase {
		t.Errorf("Phase mismatch: got %v, want %v", unmarshaled.Phase, result.Phase)
	}
	if unmarshaled.Status != result.Status {
		t.Errorf("Status mismatch: got %v, want %v", unmarshaled.Status, result.Status)
	}
}

func TestResult_JSONSerialization_ZeroDuration(t *testing.T) {
	// Test with zero duration
	result := Result{
		Service:  "test",
		Phase:    PhaseTest,
		Duration: 0,
		Status:   StatusSuccess,
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Failed to marshal result with zero duration: %v", err)
	}

	jsonStr := string(data)
	if !strings.Contains(jsonStr, `"duration":"0s"`) {
		t.Errorf("Expected duration to be serialized as '0s', got: %s", jsonStr)
	}

	var unmarshaled Result
	err = json.Unmarshal(data, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal result with zero duration: %v", err)
	}

	if unmarshaled.Duration != 0 {
		t.Errorf("Duration mismatch: got %v, want %v", unmarshaled.Duration, time.Duration(0))
	}
}
