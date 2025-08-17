package execx

import (
	"bytes"
	"context"
	"fmt"
	"testing"
)

func TestRealCommandRunner(t *testing.T) {
	runner := NewRealCommandRunner()
	cmd := runner.CommandContext(context.Background(), "echo", "hello")
	
	var stdout bytes.Buffer
	cmd.SetStdout(&stdout)
	
	err := cmd.Run()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	if stdout.String() != "hello\n" {
		t.Errorf("Expected 'hello\\n', got %q", stdout.String())
	}
}

func TestFakeCommandRunner(t *testing.T) {
	runner := NewFakeCommandRunner()
	
	// Test command creation
	cmd := runner.CommandContext(context.Background(), "test", "arg1", "arg2")
	fakeCmd := cmd.(*FakeCommand)
	
	if fakeCmd.Name != "test" {
		t.Errorf("Expected name 'test', got %q", fakeCmd.Name)
	}
	
	if len(fakeCmd.Args) != 2 || fakeCmd.Args[0] != "arg1" || fakeCmd.Args[1] != "arg2" {
		t.Errorf("Expected args [arg1, arg2], got %v", fakeCmd.Args)
	}
	
	// Test command execution with output
	var stdout, stderr bytes.Buffer
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)
	
	fakeCmd.Output = "test output"
	fakeCmd.ErrorOutput = "test error"
	
	err := cmd.Run()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	if stdout.String() != "test output" {
		t.Errorf("Expected 'test output', got %q", stdout.String())
	}
	
	if stderr.String() != "test error" {
		t.Errorf("Expected 'test error', got %q", stderr.String())
	}
	
	// Test command tracking
	if len(runner.Commands) != 1 {
		t.Errorf("Expected 1 command, got %d", len(runner.Commands))
	}
	
	if runner.Commands[0] != fakeCmd {
		t.Error("Expected command to be tracked")
	}
}

func TestFakeCommandError(t *testing.T) {
	runner := NewFakeCommandRunner()
	cmd := runner.CommandContext(context.Background(), "test")
	fakeCmd := cmd.(*FakeCommand)
	
	expectedErr := fmt.Errorf("test error")
	fakeCmd.RunError = expectedErr
	
	err := cmd.Run()
	if err != expectedErr {
		t.Errorf("Expected error %v, got %v", expectedErr, err)
	}
}

func TestFakeCommandString(t *testing.T) {
	runner := NewFakeCommandRunner()
	cmd := runner.CommandContext(context.Background(), "test", "arg1", "arg2")
	
	expected := "test arg1 arg2"
	if cmd.String() != expected {
		t.Errorf("Expected %q, got %q", expected, cmd.String())
	}
}