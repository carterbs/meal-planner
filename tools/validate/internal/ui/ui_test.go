package ui

import (
	"bytes"
	"testing"
	"time"
)

func TestFakeTTYDetector(t *testing.T) {
	detector := NewFakeTTYDetector(true)
	if !detector.IsTerminal(1) {
		t.Error("Expected IsTerminal to return true")
	}
	
	detector = NewFakeTTYDetector(false)
	if detector.IsTerminal(1) {
		t.Error("Expected IsTerminal to return false")
	}
}

func TestFakeSpinnerFactory(t *testing.T) {
	factory := NewFakeSpinnerFactory()
	var buf bytes.Buffer
	
	spinner := factory.NewSpinner(&buf)
	if len(factory.Spinners) != 1 {
		t.Errorf("Expected 1 spinner, got %d", len(factory.Spinners))
	}
	
	fakeSpinner := factory.Spinners[0]
	if fakeSpinner.Writer != &buf {
		t.Error("Expected spinner writer to be set")
	}
	
	// Test spinner operations
	spinner.Start("Starting...")
	if fakeSpinner.State != "started" {
		t.Errorf("Expected state 'started', got %s", fakeSpinner.State)
	}
	if fakeSpinner.CurrentText != "Starting..." {
		t.Errorf("Expected text 'Starting...', got %s", fakeSpinner.CurrentText)
	}
	
	spinner.UpdateText("Updated...")
	if fakeSpinner.CurrentText != "Updated..." {
		t.Errorf("Expected text 'Updated...', got %s", fakeSpinner.CurrentText)
	}
	
	spinner.Success("Done!")
	if fakeSpinner.State != "success" {
		t.Errorf("Expected state 'success', got %s", fakeSpinner.State)
	}
	
	// Check message history
	expectedMessages := []string{
		"start: Starting...",
		"update: Updated...",
		"success: Done!",
	}
	
	if len(fakeSpinner.Messages) != len(expectedMessages) {
		t.Errorf("Expected %d messages, got %d", len(expectedMessages), len(fakeSpinner.Messages))
	}
	
	for i, expected := range expectedMessages {
		if i < len(fakeSpinner.Messages) && fakeSpinner.Messages[i] != expected {
			t.Errorf("Message %d: expected %q, got %q", i, expected, fakeSpinner.Messages[i])
		}
	}
}

func TestFakeSpinnerFailure(t *testing.T) {
	factory := NewFakeSpinnerFactory()
	spinner := factory.NewSpinner(&bytes.Buffer{})
	fakeSpinner := factory.Spinners[0]
	
	spinner.Start("Starting...")
	spinner.Failure("Failed!")
	
	if fakeSpinner.State != "failure" {
		t.Errorf("Expected state 'failure', got %s", fakeSpinner.State)
	}
	if fakeSpinner.CurrentText != "Failed!" {
		t.Errorf("Expected text 'Failed!', got %s", fakeSpinner.CurrentText)
	}
}

func TestFakeSpinnerStop(t *testing.T) {
	factory := NewFakeSpinnerFactory()
	spinner := factory.NewSpinner(&bytes.Buffer{})
	fakeSpinner := factory.Spinners[0]
	
	spinner.Start("Starting...")
	spinner.Stop()
	
	if fakeSpinner.State != "stopped" {
		t.Errorf("Expected state 'stopped', got %s", fakeSpinner.State)
	}
}

func TestFakeClock(t *testing.T) {
	baseTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	clock := NewFakeClock(baseTime)
	
	if clock.Now() != baseTime {
		t.Errorf("Expected time %v, got %v", baseTime, clock.Now())
	}
	
	// Test Since calculation
	earlier := baseTime.Add(-5 * time.Minute)
	duration := clock.Since(earlier)
	if duration != 5*time.Minute {
		t.Errorf("Expected duration 5m, got %v", duration)
	}
	
	// Test Advance
	clock.Advance(10 * time.Minute)
	expected := baseTime.Add(10 * time.Minute)
	if clock.Now() != expected {
		t.Errorf("Expected time %v, got %v", expected, clock.Now())
	}
	
	// Test configured duration
	clock.Duration = 30 * time.Second
	duration = clock.Since(earlier)
	if duration != 30*time.Second {
		t.Errorf("Expected duration 30s, got %v", duration)
	}
}