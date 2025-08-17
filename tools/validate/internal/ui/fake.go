package ui

import (
	"io"
	"time"
)

// FakeTTYDetector is a mock implementation of TTYDetector for testing.
type FakeTTYDetector struct {
	IsTerminalResult bool
}

// NewFakeTTYDetector creates a new FakeTTYDetector.
func NewFakeTTYDetector(isTerminal bool) *FakeTTYDetector {
	return &FakeTTYDetector{IsTerminalResult: isTerminal}
}

// IsTerminal returns the configured result.
func (f *FakeTTYDetector) IsTerminal(fd uintptr) bool {
	return f.IsTerminalResult
}

// FakeSpinnerFactory is a mock implementation of SpinnerFactory for testing.
type FakeSpinnerFactory struct {
	Spinners           []*FakeSpinner
	MultiSpinnerManagers []*FakeMultiSpinnerManager
}

// NewFakeSpinnerFactory creates a new FakeSpinnerFactory.
func NewFakeSpinnerFactory() *FakeSpinnerFactory {
	return &FakeSpinnerFactory{}
}

// NewSpinner creates a new fake spinner.
func (f *FakeSpinnerFactory) NewSpinner(w io.Writer) Spinner {
	spinner := &FakeSpinner{Writer: w}
	f.Spinners = append(f.Spinners, spinner)
	return spinner
}

// NewMultiSpinnerManager creates a new fake multi-spinner manager.
func (f *FakeSpinnerFactory) NewMultiSpinnerManager(w io.Writer) MultiSpinnerManager {
	manager := &FakeMultiSpinnerManager{
		Writer:  w,
		Factory: f,
	}
	f.MultiSpinnerManagers = append(f.MultiSpinnerManagers, manager)
	return manager
}

// FakeSpinner is a mock implementation of Spinner for testing.
type FakeSpinner struct {
	Writer       io.Writer
	Messages     []string
	CurrentText  string
	State        string // "started", "success", "failure", "stopped"
	StartCount   int
	UpdateCount  int
	SuccessCount int
	FailureCount int
	StopCount    int
}

func (s *FakeSpinner) Start(message string) {
	s.CurrentText = message
	s.State = "started"
	s.StartCount++
	s.Messages = append(s.Messages, "start: "+message)
}

func (s *FakeSpinner) UpdateText(message string) {
	s.CurrentText = message
	s.UpdateCount++
	s.Messages = append(s.Messages, "update: "+message)
}

func (s *FakeSpinner) Success(message string) {
	s.CurrentText = message
	s.State = "success"
	s.SuccessCount++
	s.Messages = append(s.Messages, "success: "+message)
}

func (s *FakeSpinner) Failure(message string) {
	s.CurrentText = message
	s.State = "failure"
	s.FailureCount++
	s.Messages = append(s.Messages, "failure: "+message)
}

func (s *FakeSpinner) Stop() {
	s.State = "stopped"
	s.StopCount++
	s.Messages = append(s.Messages, "stop")
}

// FakeClock is a mock implementation of Clock for testing.
type FakeClock struct {
	CurrentTime time.Time
	Duration    time.Duration
}

// NewFakeClock creates a new FakeClock with the given current time.
func NewFakeClock(now time.Time) *FakeClock {
	return &FakeClock{CurrentTime: now}
}

// Now returns the configured current time.
func (c *FakeClock) Now() time.Time {
	return c.CurrentTime
}

// Since returns the configured duration.
func (c *FakeClock) Since(t time.Time) time.Duration {
	if c.Duration != 0 {
		return c.Duration
	}
	return c.CurrentTime.Sub(t)
}

// Advance advances the fake clock by the given duration.
func (c *FakeClock) Advance(d time.Duration) {
	c.CurrentTime = c.CurrentTime.Add(d)
}

// FakeMultiSpinnerManager is a mock implementation of MultiSpinnerManager for testing.
type FakeMultiSpinnerManager struct {
	Writer   io.Writer
	Factory  *FakeSpinnerFactory
	Started  bool
	Stopped  bool
	Spinners []Spinner
}

func (m *FakeMultiSpinnerManager) Start() {
	m.Started = true
}

func (m *FakeMultiSpinnerManager) Stop() {
	m.Stopped = true
}

func (m *FakeMultiSpinnerManager) NewSpinner() Spinner {
	spinner := m.Factory.NewSpinner(m.Writer)
	m.Spinners = append(m.Spinners, spinner)
	return spinner
}
