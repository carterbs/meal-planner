// Package execx provides an interface for command execution that can be mocked for testing.
package execx

import (
	"context"
	"io"
	"os/exec"
)

// CommandRunner defines the interface for executing commands.
type CommandRunner interface {
	// CommandContext creates a command with the given context, name, and arguments.
	CommandContext(ctx context.Context, name string, args ...string) Command
}

// Command represents a command that can be executed.
type Command interface {
	// SetDir sets the working directory for the command.
	SetDir(dir string)
	// SetStdout sets the stdout writer for the command.
	SetStdout(w io.Writer)
	// SetStderr sets the stderr writer for the command.
	SetStderr(w io.Writer)
	// SetStdin sets the stdin reader for the command.
	SetStdin(r io.Reader)
	// SetEnv sets the environment variables for the command.
	SetEnv(env []string)
	// Run executes the command and waits for it to complete.
	Run() error
	// Start starts the command but does not wait for it to complete.
	Start() error
	// Wait waits for the command to complete.
	Wait() error
	// String returns a string representation of the command.
	String() string
}

// RealCommandRunner implements CommandRunner using the standard os/exec package.
type RealCommandRunner struct{}

// NewRealCommandRunner creates a new RealCommandRunner.
func NewRealCommandRunner() *RealCommandRunner {
	return &RealCommandRunner{}
}

// CommandContext creates a new command with the given context.
func (r *RealCommandRunner) CommandContext(ctx context.Context, name string, args ...string) Command {
	cmd := exec.CommandContext(ctx, name, args...)
	return &realCommand{cmd: cmd}
}

type realCommand struct {
	cmd *exec.Cmd
}

func (c *realCommand) SetDir(dir string) {
	c.cmd.Dir = dir
}

func (c *realCommand) SetStdout(w io.Writer) {
	c.cmd.Stdout = w
}

func (c *realCommand) SetStderr(w io.Writer) {
	c.cmd.Stderr = w
}

func (c *realCommand) SetStdin(r io.Reader) {
	c.cmd.Stdin = r
}

func (c *realCommand) SetEnv(env []string) {
	c.cmd.Env = env
}

func (c *realCommand) Run() error {
	return c.cmd.Run()
}

func (c *realCommand) Start() error {
	return c.cmd.Start()
}

func (c *realCommand) Wait() error {
	return c.cmd.Wait()
}

func (c *realCommand) String() string {
	return c.cmd.String()
}