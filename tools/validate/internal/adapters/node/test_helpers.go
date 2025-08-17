package nodeadapter

import (
	"context"
	"io"

	"github.com/bradcarter-meal-planner/tools/validate/internal/execx"
)

// TestFakeCommandRunner is a test helper that implements execx.CommandRunner for testing.
type TestFakeCommandRunner struct {
	Commands  []*TestFakeCommand
	responses []TestResponse
	index     int
}

// TestResponse represents a configured response for a command.
type TestResponse struct {
	Stdout string
	Stderr string
	Error  error
}

// NewTestFakeCommandRunner creates a new test fake command runner.
func NewTestFakeCommandRunner() *TestFakeCommandRunner {
	return &TestFakeCommandRunner{
		Commands:  []*TestFakeCommand{},
		responses: []TestResponse{},
	}
}

// SetNextResponse configures the next command response.
func (f *TestFakeCommandRunner) SetNextResponse(stdout, stderr string, err error) {
	f.responses = append(f.responses, TestResponse{
		Stdout: stdout,
		Stderr: stderr,
		Error:  err,
	})
}

// CommandContext creates a new fake command.
func (f *TestFakeCommandRunner) CommandContext(ctx context.Context, name string, args ...string) execx.Command {
	cmd := &TestFakeCommand{
		Name:    name,
		Args:    args,
		Context: ctx,
		runner:  f,
	}
	f.Commands = append(f.Commands, cmd)
	return cmd
}

// TestFakeCommand is a test implementation of execx.Command.
type TestFakeCommand struct {
	Name    string
	Args    []string
	Context context.Context
	Dir     string
	Stdout  io.Writer
	Stderr  io.Writer
	Stdin   io.Reader
	Env     []string
	runner  *TestFakeCommandRunner
}

func (c *TestFakeCommand) SetDir(dir string) {
	c.Dir = dir
}

func (c *TestFakeCommand) SetStdout(w io.Writer) {
	c.Stdout = w
}

func (c *TestFakeCommand) SetStderr(w io.Writer) {
	c.Stderr = w
}

func (c *TestFakeCommand) SetStdin(r io.Reader) {
	c.Stdin = r
}

func (c *TestFakeCommand) SetEnv(env []string) {
	c.Env = env
}

func (c *TestFakeCommand) Run() error {
	if c.runner.index >= len(c.runner.responses) {
		return nil
	}

	response := c.runner.responses[c.runner.index]
	c.runner.index++

	if c.Stdout != nil && response.Stdout != "" {
		c.Stdout.Write([]byte(response.Stdout))
	}
	if c.Stderr != nil && response.Stderr != "" {
		c.Stderr.Write([]byte(response.Stderr))
	}

	return response.Error
}

func (c *TestFakeCommand) Start() error {
	return c.Run()
}

func (c *TestFakeCommand) Wait() error {
	return nil
}

func (c *TestFakeCommand) String() string {
	result := c.Name
	for _, arg := range c.Args {
		result += " " + arg
	}
	return result
}