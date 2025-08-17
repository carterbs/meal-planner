package goadapter

import (
	"context"
	"strings"

	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
)

// TestFakeCommandRunner is a specialized fake command runner for testing.
type TestFakeCommandRunner struct {
	Commands      []*execx.FakeCommand
	NextOutput    string
	NextError     error
	NextErrorOutput string
}

// CommandContext creates a pre-configured fake command.
func (f *TestFakeCommandRunner) CommandContext(ctx context.Context, name string, args ...string) execx.Command {
	cmd := &execx.FakeCommand{
		Name:        name,
		Args:        args,
		Context:     ctx,
		Output:      f.NextOutput,
		ErrorOutput: f.NextErrorOutput,
		RunError:    f.NextError,
	}
	f.Commands = append(f.Commands, cmd)
	return cmd
}

// SetNextResponse configures the response for the next command.
func (f *TestFakeCommandRunner) SetNextResponse(stdout, stderr string, err error) {
	f.NextOutput = stdout
	f.NextErrorOutput = stderr
	f.NextError = err
}

// contains is a helper function for tests
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}