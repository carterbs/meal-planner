package orchestrator

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
	"github.com/bradcarter-meal-planner/tools/validate/internal/ui"
)

func TestNewWatchOrchestrator(t *testing.T) {
	cfg := &config.Config{}
	commandRunner := execx.NewFakeCommandRunner()
	spinnerFactory := ui.NewFakeSpinnerFactory()
	ttyDetector := ui.NewFakeTTYDetector(true)
	clock := ui.NewFakeClock(time.Now())
	output := &bytes.Buffer{}
	errorOutput := &bytes.Buffer{}

	watchOrch := NewWatchOrchestrator(
		cfg,
		commandRunner,
		spinnerFactory,
		ttyDetector,
		clock,
		output,
		errorOutput,
	)

	if watchOrch.config != cfg {
		t.Error("config not properly set")
	}
	if watchOrch.commandRunner != commandRunner {
		t.Error("command runner not properly set")
	}
	if watchOrch.output != output {
		t.Error("output not properly set")
	}
}

func TestWatchOrchestrator_outputText(t *testing.T) {
	cfg := &config.Config{}
	commandRunner := execx.NewFakeCommandRunner()
	spinnerFactory := ui.NewFakeSpinnerFactory()
	ttyDetector := ui.NewFakeTTYDetector(true)
	clock := ui.NewFakeClock(time.Date(2023, 1, 1, 12, 30, 45, 0, time.UTC))
	output := &bytes.Buffer{}
	errorOutput := &bytes.Buffer{}

	watchOrch := NewWatchOrchestrator(
		cfg,
		commandRunner,
		spinnerFactory,
		ttyDetector,
		clock,
		output,
		errorOutput,
	)

	t.Run("successful results", func(t *testing.T) {
		output.Reset()
		
		results := []runner.Result{
			{
				Service: "ui",
				Phase:   runner.PhaseLint,
				Status:  runner.StatusSuccess,
			},
			{
				Service: "api",
				Phase:   runner.PhaseLint,
				Status:  runner.StatusSuccess,
			},
		}

		err := watchOrch.outputText(results, false)
		if err != nil {
			t.Fatalf("outputText failed: %v", err)
		}

		outputStr := output.String()
		if !strings.Contains(outputStr, "[12:30:45]") {
			t.Error("expected timestamp in output")
		}
		if !strings.Contains(outputStr, "✅ 2 passed") {
			t.Error("expected success count in output")
		}
	})

	t.Run("failed results", func(t *testing.T) {
		output.Reset()
		
		results := []runner.Result{
			{
				Service: "ui",
				Phase:   runner.PhaseLint,
				Status:  runner.StatusFailure,
				Failures: []runner.Failure{
					{
						Message: "Unused variable",
						File:    "main.ts",
						Line:    42,
					},
				},
			},
		}

		err := watchOrch.outputText(results, true) // verbose = true
		if err != nil {
			t.Fatalf("outputText failed: %v", err)
		}

		outputStr := output.String()
		if !strings.Contains(outputStr, "❌ 1 failed") {
			t.Error("expected failure count in output")
		}
		if !strings.Contains(outputStr, "Unused variable") {
			t.Error("expected failure message in output")
		}
		if !strings.Contains(outputStr, "main.ts:42") {
			t.Error("expected file location in verbose output")
		}
	})
}

func TestWatchOrchestrator_shouldUseSpinners(t *testing.T) {
	cfg := &config.Config{}
	commandRunner := execx.NewFakeCommandRunner()
	spinnerFactory := ui.NewFakeSpinnerFactory()
	ttyDetector := ui.NewFakeTTYDetector(true)
	clock := ui.NewFakeClock(time.Now())
	output := &bytes.Buffer{}
	errorOutput := &bytes.Buffer{}

	watchOrch := NewWatchOrchestrator(
		cfg,
		commandRunner,
		spinnerFactory,
		ttyDetector,
		clock,
		output,
		errorOutput,
	)

	// Test CI mode disables spinners
	opts := WatchOptions{CI: true}
	result := watchOrch.shouldUseSpinners(opts)
	if result != false {
		t.Errorf("expected false for CI mode, got %v", result)
	}
}