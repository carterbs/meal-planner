package execx

import (
	"context"
	"fmt"
	"io"
	"strings"
)

// FakeCommandRunner is a mock implementation of CommandRunner for testing.
type FakeCommandRunner struct {
	Commands []*FakeCommand
}

// NewFakeCommandRunner creates a new FakeCommandRunner.
func NewFakeCommandRunner() *FakeCommandRunner {
	return &FakeCommandRunner{}
}

// CommandContext creates a new fake command.
func (f *FakeCommandRunner) CommandContext(ctx context.Context, name string, args ...string) Command {
	cmd := &FakeCommand{
		Name:    name,
		Args:    args,
		Context: ctx,
	}
	f.Commands = append(f.Commands, cmd)
	return cmd
}

// FakeCommand is a mock implementation of Command for testing.
type FakeCommand struct {
	Name     string
	Args     []string
	Context  context.Context
	Dir      string
	Stdout   io.Writer
	Stderr   io.Writer
	Stdin    io.Reader
	Env      []string
	RunError error
	Output   string
	ErrorOutput string
}

func (c *FakeCommand) SetDir(dir string) {
	c.Dir = dir
}

func (c *FakeCommand) SetStdout(w io.Writer) {
	c.Stdout = w
}

func (c *FakeCommand) SetStderr(w io.Writer) {
	c.Stderr = w
}

func (c *FakeCommand) SetStdin(r io.Reader) {
	c.Stdin = r
}

func (c *FakeCommand) SetEnv(env []string) {
	c.Env = env
}

func (c *FakeCommand) Run() error {
	if c.Stdout != nil && c.Output != "" {
		fmt.Fprint(c.Stdout, c.Output)
	}
	if c.Stderr != nil && c.ErrorOutput != "" {
		fmt.Fprint(c.Stderr, c.ErrorOutput)
	}
	return c.RunError
}

func (c *FakeCommand) Start() error {
	return c.RunError
}

func (c *FakeCommand) Wait() error {
	return c.RunError
}

func (c *FakeCommand) String() string {
	return c.Name + " " + strings.Join(c.Args, " ")
}