package main

import (
	"testing"

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
