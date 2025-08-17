// Package ui provides interfaces for terminal UI components like spinners.
package ui

import (
	"io"
	"time"
)

// TTYDetector provides an interface for detecting if output is a TTY.
type TTYDetector interface {
	// IsTerminal returns true if the given file descriptor is a terminal.
	IsTerminal(fd uintptr) bool
}

// Spinner provides an interface for displaying progress spinners.
type Spinner interface {
	// Start begins the spinner animation with the given message.
	Start(message string)
	// UpdateText updates the spinner message.
	UpdateText(message string)
	// Success stops the spinner and shows a success message.
	Success(message string)
	// Failure stops the spinner and shows a failure message.
	Failure(message string)
	// Stop stops the spinner without showing a final message.
	Stop()
}

// SpinnerFactory creates spinners.
type SpinnerFactory interface {
	// NewSpinner creates a new spinner that writes to the given writer.
	NewSpinner(w io.Writer) Spinner
}

// Clock provides an interface for time operations that can be mocked in tests.
type Clock interface {
	// Now returns the current time.
	Now() time.Time
	// Since returns the duration since the given time.
	Since(t time.Time) time.Duration
}