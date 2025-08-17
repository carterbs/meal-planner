package ui

import (
	"io"
	"os"
	"time"

	"github.com/mattn/go-isatty"
	"github.com/pterm/pterm"
)

// RealTTYDetector implements TTYDetector using go-isatty.
type RealTTYDetector struct{}

// NewRealTTYDetector creates a new RealTTYDetector.
func NewRealTTYDetector() *RealTTYDetector {
	return &RealTTYDetector{}
}

// IsTerminal returns true if the given file descriptor is a terminal.
func (r *RealTTYDetector) IsTerminal(fd uintptr) bool {
	return isatty.IsTerminal(fd)
}

// RealSpinnerFactory implements SpinnerFactory using pterm.
type RealSpinnerFactory struct{}

// NewRealSpinnerFactory creates a new RealSpinnerFactory.
func NewRealSpinnerFactory() *RealSpinnerFactory {
	return &RealSpinnerFactory{}
}

// NewSpinner creates a new spinner using pterm.
func (f *RealSpinnerFactory) NewSpinner(w io.Writer) Spinner {
	spinner := pterm.DefaultSpinner
	spinner.Writer = w
	return &realSpinner{spinner: &spinner}
}

// NewMultiSpinnerManager creates a new multi-spinner manager using pterm.
func (f *RealSpinnerFactory) NewMultiSpinnerManager(w io.Writer) MultiSpinnerManager {
	multi := pterm.DefaultMultiPrinter
	multi.Writer = w
	return &realMultiSpinnerManager{multi: &multi}
}

type realSpinner struct {
	spinner *pterm.SpinnerPrinter
	active  bool
}

func (s *realSpinner) Start(message string) {
	if s.active {
		s.Stop()
	}
	s.spinner.Text = message
	s.spinner, _ = s.spinner.Start()
	s.active = true
}

func (s *realSpinner) UpdateText(message string) {
	if s.active {
		s.spinner.UpdateText(message)
	}
}

func (s *realSpinner) Success(message string) {
	if s.active {
		s.spinner.Success(message)
		s.active = false
	}
}

func (s *realSpinner) Failure(message string) {
	if s.active {
		s.spinner.Fail(message)
		s.active = false
	}
}

func (s *realSpinner) Stop() {
	if s.active {
		s.spinner.Stop()
		s.active = false
	}
}

// RealClock implements Clock using the standard time package.
type RealClock struct{}

// NewRealClock creates a new RealClock.
func NewRealClock() *RealClock {
	return &RealClock{}
}

// Now returns the current time.
func (c *RealClock) Now() time.Time {
	return time.Now()
}

// Since returns the duration since the given time.
func (c *RealClock) Since(t time.Time) time.Duration {
	return time.Since(t)
}

type realMultiSpinnerManager struct {
	multi   *pterm.MultiPrinter
	started bool
}

func (m *realMultiSpinnerManager) Start() {
	if !m.started {
		m.multi, _ = m.multi.Start()
		m.started = true
	}
}

func (m *realMultiSpinnerManager) Stop() {
	if m.started {
		m.multi.Stop()
		m.started = false
	}
}

func (m *realMultiSpinnerManager) NewSpinner() Spinner {
	writer := m.multi.NewWriter()
	spinner := pterm.DefaultSpinner.WithWriter(writer)
	return &realSpinner{spinner: spinner}
}

// IsStdoutTerminal returns true if stdout is a terminal.
func IsStdoutTerminal() bool {
	detector := NewRealTTYDetector()
	return detector.IsTerminal(os.Stdout.Fd())
}
