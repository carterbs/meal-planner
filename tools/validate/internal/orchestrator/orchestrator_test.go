package orchestrator

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
	"github.com/bradcarter-meal-planner/tools/validate/internal/ui"
)

// Test dependencies
type fakeRunner struct {
	serviceName string
	testResult  runner.Result
	lintResult  runner.Result
	buildResult runner.Result
}

func (f *fakeRunner) Test() runner.Result {
	result := f.testResult
	result.Service = f.serviceName
	result.Phase = runner.PhaseTest
	if result.Status == "" {
		result.Status = runner.StatusSuccess
	}
	return result
}

func (f *fakeRunner) Lint() runner.Result {
	result := f.lintResult
	result.Service = f.serviceName
	result.Phase = runner.PhaseLint
	if result.Status == "" {
		result.Status = runner.StatusSuccess
	}
	return result
}

func (f *fakeRunner) Build() runner.Result {
	result := f.buildResult
	result.Service = f.serviceName
	result.Phase = runner.PhaseBuild
	if result.Status == "" {
		result.Status = runner.StatusSuccess
	}
	return result
}

// testOrchestrator allows us to inject fake runners for testing
type testOrchestrator struct {
	*Orchestrator
	runnerFactory func(service config.Service) (runner.Runner, error)
}

func (t *testOrchestrator) createRunner(service config.Service) (runner.Runner, error) {
	if t.runnerFactory != nil {
		return t.runnerFactory(service)
	}
	return t.Orchestrator.createRunner(service)
}

func createTestConfig() *config.Config {
	return &config.Config{
		Services: []config.Service{
			{Name: "service-a", Type: config.ServiceTypeGo, Dir: "./a"},
			{Name: "service-b", Type: config.ServiceTypeNode, Dir: "./b"},
			{Name: "service-c", Type: config.ServiceTypeGo, Dir: "./c"},
		},
	}
}

func createSuccessfulCommandRunner() *execx.FakeCommandRunner {
	return &execx.FakeCommandRunner{}
}

func createFailingCommandRunner() *execx.FakeCommandRunner {
	runner := &execx.FakeCommandRunner{}
	// We'll need to set up the next command to fail
	// For now, let's just use the same runner and rely on the parsers
	return runner
}

func createSuccessfulRunnerFactory() RunnerFactory {
	return func(service config.Service) (runner.Runner, error) {
		return &fakeRunner{serviceName: service.Name}, nil
	}
}

func createFailingRunnerFactory() RunnerFactory {
	return func(service config.Service) (runner.Runner, error) {
		return &fakeRunner{
			serviceName: service.Name,
			testResult:  runner.Result{Status: runner.StatusFailure},
			lintResult:  runner.Result{Status: runner.StatusFailure},
			buildResult: runner.Result{Status: runner.StatusFailure},
		}, nil
	}
}

func TestOrchestrator_Execute_Success(t *testing.T) {
	cfg := createTestConfig()
	
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		&ui.FakeSpinnerFactory{},
		&ui.FakeTTYDetector{IsTerminalResult: false},
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase:       runner.PhaseTest,
		MaxParallel: 2,
		JSON:        true,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify JSON output was written
	if stdout.Len() == 0 {
		t.Error("Expected output to be written")
	}

	// Parse and verify JSON output
	var results []runner.Result
	if err := json.Unmarshal(stdout.Bytes(), &results); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	if len(results) != 3 {
		t.Errorf("Expected 3 results, got %d", len(results))
	}

	// Verify results are sorted by service name
	expectedServices := []string{"service-a", "service-b", "service-c"}
	for i, result := range results {
		if result.Service != expectedServices[i] {
			t.Errorf("Expected service %s at position %d, got %s", expectedServices[i], i, result.Service)
		}
		if result.Phase != runner.PhaseTest {
			t.Errorf("Expected phase %s, got %s", runner.PhaseTest, result.Phase)
		}
	}
}

func TestOrchestrator_Execute_WithFailures(t *testing.T) {
	cfg := createTestConfig()
	
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createFailingCommandRunner(),
		&ui.FakeSpinnerFactory{},
		&ui.FakeTTYDetector{IsTerminalResult: false},
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase:       runner.PhaseTest,
		MaxParallel: 1,
		JSON:        true,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createFailingRunnerFactory())
	
	// Should return error when services fail
	if err == nil {
		t.Error("Expected error when services fail")
	}

	if !strings.Contains(err.Error(), "one or more services failed") {
		t.Errorf("Expected 'one or more services failed' error, got: %v", err)
	}
}

func TestOrchestrator_Execute_ServiceFiltering(t *testing.T) {
	cfg := createTestConfig()
	
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		&ui.FakeSpinnerFactory{},
		&ui.FakeTTYDetector{IsTerminalResult: false},
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase:    runner.PhaseTest,
		Services: []string{"service-a", "service-c"},
		JSON:     true,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Parse JSON output
	var results []runner.Result
	if err := json.Unmarshal(stdout.Bytes(), &results); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 results after filtering, got %d", len(results))
	}

	// Verify only the requested services were executed
	expectedServices := []string{"service-a", "service-c"}
	for i, result := range results {
		if result.Service != expectedServices[i] {
			t.Errorf("Expected service %s at position %d, got %s", expectedServices[i], i, result.Service)
		}
	}
}

func TestOrchestrator_Execute_NoMatchingServices(t *testing.T) {
	cfg := createTestConfig()
	
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		&ui.FakeSpinnerFactory{},
		&ui.FakeTTYDetector{IsTerminalResult: false},
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase:    runner.PhaseTest,
		Services: []string{"nonexistent"},
		JSON:     true,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err == nil {
		t.Error("Expected error when no matching services found")
	}

	if !strings.Contains(err.Error(), "no matching services found") {
		t.Errorf("Expected 'no matching services found' error, got: %v", err)
	}
}

func TestOrchestrator_Execute_Spinners(t *testing.T) {
	cfg := createTestConfig()
	
	spinnerFactory := &ui.FakeSpinnerFactory{}
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		spinnerFactory,
		&ui.FakeTTYDetector{IsTerminalResult: true}, // Simulate TTY
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase:       runner.PhaseTest,
		MaxParallel: 1,
		JSON:        false, // Don't use JSON to enable spinners
		CI:          false,
		NoSpinner:   false,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify spinners were used
	if len(spinnerFactory.Spinners) != 3 {
		t.Errorf("Expected 3 spinners to be created, got %d", len(spinnerFactory.Spinners))
	}

	// Verify spinner lifecycle
	for _, spinner := range spinnerFactory.Spinners {
		if spinner.StartCount == 0 {
			t.Error("Expected spinner to be started")
		}
		if spinner.StopCount == 0 && spinner.SuccessCount == 0 && spinner.FailureCount == 0 {
			t.Error("Expected spinner to be stopped or finished")
		}
	}
}

func TestOrchestrator_Execute_NoSpinnersInCI(t *testing.T) {
	cfg := createTestConfig()
	
	spinnerFactory := &ui.FakeSpinnerFactory{}
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		spinnerFactory,
		&ui.FakeTTYDetector{IsTerminalResult: true}, // Simulate TTY
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase: runner.PhaseTest,
		CI:    true, // CI mode should disable spinners
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify no spinners were created in CI mode
	if len(spinnerFactory.Spinners) != 0 {
		t.Errorf("Expected 0 spinners in CI mode, got %d", len(spinnerFactory.Spinners))
	}
}

func TestOrchestrator_Execute_NoSpinnersWhenNotTTY(t *testing.T) {
	cfg := createTestConfig()
	
	spinnerFactory := &ui.FakeSpinnerFactory{}
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		spinnerFactory,
		&ui.FakeTTYDetector{IsTerminalResult: false}, // Not a TTY
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase:     runner.PhaseTest,
		CI:        false,
		NoSpinner: false,
		JSON:      false,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify no spinners were created when not TTY
	if len(spinnerFactory.Spinners) != 0 {
		t.Errorf("Expected 0 spinners when not TTY, got %d", len(spinnerFactory.Spinners))
	}
}

func TestOrchestrator_Execute_VerboseOutput(t *testing.T) {
	cfg := createTestConfig()
	
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		&ui.FakeSpinnerFactory{},
		&ui.FakeTTYDetector{IsTerminalResult: false},
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase:   runner.PhaseTest,
		Verbose: true,
		JSON:    false,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	output := stdout.String()
	
	// Verify human-readable output (not JSON)
	var jsonResult []runner.Result
	if json.Unmarshal([]byte(output), &jsonResult) == nil {
		t.Error("Expected human-readable output, got JSON")
	}

	// Should contain service names in output
	if !strings.Contains(output, "service-a") {
		t.Error("Expected service-a in output")
	}
	if !strings.Contains(output, "service-b") {
		t.Error("Expected service-b in output")
	}
	if !strings.Contains(output, "service-c") {
		t.Error("Expected service-c in output")
	}
}

func TestOrchestrator_Execute_ClockInjection(t *testing.T) {
	cfg := createTestConfig()
	
	fakeClock := &ui.FakeClock{
		CurrentTime: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
		Duration:    2 * time.Second,
	}
	
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		&ui.FakeSpinnerFactory{},
		&ui.FakeTTYDetector{IsTerminalResult: false},
		fakeClock,
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase: runner.PhaseTest,
		JSON:  true,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Parse JSON output and verify timing
	var results []runner.Result
	if err := json.Unmarshal(stdout.Bytes(), &results); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	// Verify all results have the expected duration from the fake clock
	for _, result := range results {
		if result.Duration != 2*time.Second {
			t.Errorf("Expected duration 2s from fake clock, got %v", result.Duration)
		}
	}
}

func TestOrchestrator_Execute_CancelledContext(t *testing.T) {
	cfg := createTestConfig()
	
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		&ui.FakeSpinnerFactory{},
		&ui.FakeTTYDetector{IsTerminalResult: false},
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase: runner.PhaseTest,
		JSON:  true,
	}

	// Create a cancelled context
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := orch.Execute(ctx, opts)
	// Should still complete because we don't abort on context cancellation
	// The errgroup will handle the cancellation, but we let services finish
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
}

func TestOrchestrator_Execute_MaxParallelDefault(t *testing.T) {
	cfg := createTestConfig()
	
	var stdout, stderr bytes.Buffer
	orch := New(
		cfg,
		createSuccessfulCommandRunner(),
		&ui.FakeSpinnerFactory{},
		&ui.FakeTTYDetector{IsTerminalResult: false},
		&ui.FakeClock{},
		&stdout,
		&stderr,
	)

	opts := Options{
		Phase:       runner.PhaseTest,
		MaxParallel: 0, // Should default to GOMAXPROCS
		JSON:        true,
	}

	err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Test passed if no errors - maxParallel defaults are handled internally
}

func TestOrchestrator_Execute_AllPhases(t *testing.T) {
	testCases := []struct {
		name  string
		phase runner.Phase
	}{
		{"test", runner.PhaseTest},
		{"lint", runner.PhaseLint},
		{"build", runner.PhaseBuild},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := createTestConfig()
			
			var stdout, stderr bytes.Buffer
			orch := New(
				cfg,
				createSuccessfulCommandRunner(),
				&ui.FakeSpinnerFactory{},
				&ui.FakeTTYDetector{IsTerminalResult: false},
				&ui.FakeClock{},
				&stdout,
				&stderr,
			)

			opts := Options{
				Phase: tc.phase,
				JSON:  true,
			}

			err := orch.ExecuteWithFactory(context.Background(), opts, createSuccessfulRunnerFactory())
			if err != nil {
				t.Fatalf("Expected no error for phase %s, got: %v", tc.phase, err)
			}

			// Parse and verify results have correct phase
			var results []runner.Result
			if err := json.Unmarshal(stdout.Bytes(), &results); err != nil {
				t.Fatalf("Failed to parse JSON output: %v", err)
			}

			for _, result := range results {
				if result.Phase != tc.phase {
					t.Errorf("Expected phase %s, got %s", tc.phase, result.Phase)
				}
			}
		})
	}
}

func TestOrchestrator_shouldUseSpinners(t *testing.T) {
	tests := []struct {
		name     string
		opts     Options
		isTTY    bool
		expected bool
	}{
		{
			name:     "CI mode disables spinners",
			opts:     Options{CI: true},
			isTTY:    true,
			expected: false,
		},
		{
			name:     "NoSpinner flag disables spinners",
			opts:     Options{NoSpinner: true},
			isTTY:    true,
			expected: false,
		},
		{
			name:     "Non-TTY disables spinners",
			opts:     Options{},
			isTTY:    false,
			expected: false,
		},
		{
			name:     "TTY with default options enables spinners",
			opts:     Options{},
			isTTY:    true,
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			orch := &Orchestrator{
				ttyDetector: &ui.FakeTTYDetector{IsTerminalResult: tt.isTTY},
			}

			result := orch.shouldUseSpinners(tt.opts)
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}