package orchestrator

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
	"github.com/bradcarter-meal-planner/tools/validate/internal/ui"
)

func TestOrchestrator_QuietOutput_Golden(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{Name: "service-a", Type: config.ServiceTypeGo},
			{Name: "service-b", Type: config.ServiceTypeNode},
			{Name: "service-c", Type: config.ServiceTypeGo},
		},
	}

	var stdout, stderr bytes.Buffer
	fakeClock := ui.NewFakeClock(time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC))
	fakeClock.Duration = 2 * time.Second

	orch := New(cfg, nil, &ui.FakeSpinnerFactory{}, &ui.FakeTTYDetector{IsTerminalResult: false}, fakeClock, &stdout, &stderr)

	// Runner factory that returns successful results with no failures
	factory := func(service config.Service) (runner.Runner, error) {
		return &fakeRunner{serviceName: service.Name}, nil
	}

	opts := Options{Phase: runner.PhaseTest, JSON: false, Verbose: false}

	if err := orch.ExecuteWithFactory(context.Background(), opts, factory); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := "✓ service-a: (2.0s)\n✓ service-b: (2.0s)\n✓ service-c: (2.0s)\n"
	if stdout.String() != expected {
		t.Fatalf("quiet output did not match golden.\nExpected:\n%q\nGot:\n%q", expected, stdout.String())
	}
}

func TestOrchestrator_VerboseOutput_Golden(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{Name: "service-a", Type: config.ServiceTypeGo},
			{Name: "service-b", Type: config.ServiceTypeNode},
			{Name: "service-c", Type: config.ServiceTypeGo},
		},
	}

	var stdout, stderr bytes.Buffer
	fakeClock := ui.NewFakeClock(time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC))
	fakeClock.Duration = 2 * time.Second

	orch := New(cfg, nil, &ui.FakeSpinnerFactory{}, &ui.FakeTTYDetector{IsTerminalResult: false}, fakeClock, &stdout, &stderr)

	// Runner factory that returns a failure for service-a
	factory := func(service config.Service) (runner.Runner, error) {
		if service.Name == "service-a" {
			return &fakeRunner{
				serviceName: service.Name,
				testResult: runner.Result{
					Status: runner.StatusFailure,
					Failures: []runner.Failure{
						{File: "a.go", Line: 10, Message: "first failure"},
						{File: "b.go", Line: 0, Message: "second failure"},
					},
				},
			}, nil
		}
		return &fakeRunner{serviceName: service.Name}, nil
	}

	opts := Options{Phase: runner.PhaseTest, JSON: false, Verbose: true}

	err := orch.ExecuteWithFactory(context.Background(), opts, factory)
	if err == nil {
		t.Fatalf("expected error when services fail")
	}
	if !strings.Contains(err.Error(), "one or more services failed") {
		t.Fatalf("expected failure reason to contain 'one or more services failed', got: %v", err)
	}

	got := stdout.String()
	// For readability in assertions, ensure expected is a substring and structural check
	if !containsAll(got, []string{"service-a", "first failure", "service-b", "service-c"}) {
		t.Fatalf("verbose output missing expected pieces.\nGot:\n%q", got)
	}
}

func containsAll(s string, parts []string) bool {
	for _, p := range parts {
		if !bytes.Contains([]byte(s), []byte(p)) {
			return false
		}
	}
	return true
}
