// Package runner defines the core types and interfaces for running build operations.
package runner

import (
	"time"
)

// Phase represents the type of build operation being performed.
type Phase string

const (
	// PhaseTest represents running tests
	PhaseTest Phase = "test"
	// PhaseLint represents running linters
	PhaseLint Phase = "lint"
	// PhaseBuild represents running builds
	PhaseBuild Phase = "build"
)

// String returns the string representation of the phase.
func (p Phase) String() string {
	return string(p)
}

// Status represents the result status of a build operation.
type Status string

const (
	// StatusSuccess indicates the operation completed successfully
	StatusSuccess Status = "success"
	// StatusFailure indicates the operation failed
	StatusFailure Status = "failure"
	// StatusError indicates the operation encountered an error
	StatusError Status = "error"
)

// String returns the string representation of the status.
func (s Status) String() string {
	return string(s)
}

// Failure represents a specific failure in a test or lint operation.
type Failure struct {
	// File is the file where the failure occurred
	File string `json:"file"`
	// Line is the line number where the failure occurred (0 if not available)
	Line int `json:"line"`
	// Message is the failure message
	Message string `json:"message"`
	// Type is the type of failure (e.g., "test", "lint", "error")
	Type string `json:"type,omitempty"`
}

// Coverage represents test coverage information.
type Coverage struct {
	// Percentage is the coverage percentage (0-100)
	Percentage float64 `json:"percentage"`
	// Covered is the number of covered lines/statements
	Covered int `json:"covered"`
	// Total is the total number of lines/statements
	Total int `json:"total"`
	// Details contains additional coverage details by file
	Details map[string]FileCoverage `json:"details,omitempty"`
}

// FileCoverage represents coverage information for a specific file.
type FileCoverage struct {
	// Percentage is the coverage percentage for this file (0-100)
	Percentage float64 `json:"percentage"`
	// Covered is the number of covered lines/statements in this file
	Covered int `json:"covered"`
	// Total is the total number of lines/statements in this file
	Total int `json:"total"`
}

// Result represents the result of a build operation.
type Result struct {
	// Service is the name of the service that was built
	Service string `json:"service"`
	// Phase is the type of operation that was performed
	Phase Phase `json:"phase"`
	// Duration is how long the operation took
	Duration time.Duration `json:"duration"`
	// Status is the result status
	Status Status `json:"status"`
	// Coverage contains test coverage information (only for test phase)
	Coverage *Coverage `json:"coverage,omitempty"`
	// Failures contains any failures that occurred
	Failures []Failure `json:"failures,omitempty"`
	// PassedCount is the number of passed tests/checks
	PassedCount int `json:"passed_count,omitempty"`
	// FailedCount is the number of failed tests/checks
	FailedCount int `json:"failed_count,omitempty"`
	// WarningCount is the number of warnings (for lint phase)
	WarningCount int `json:"warning_count,omitempty"`
	// ErrorMessage contains the error message if Status is StatusError
	ErrorMessage string `json:"error_message,omitempty"`
}

// Runner defines the interface for running build operations on services.
type Runner interface {
	// Test runs tests for the service and returns the result
	Test() Result
	// Lint runs linting for the service and returns the result
	Lint() Result
	// Build runs the build for the service and returns the result
	Build() Result
}
