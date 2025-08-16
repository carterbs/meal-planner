# Build Tool for Minimized Output

## Overview
Create a unified Go build utility that provides clean, minimal output by default for build, lint, and test workflows across Go and TypeScript subprojects, with verbose mode as an opt‑in.

## Quality bar (added):
	•	The build tool’s own code must maintain 100% line coverage across all non‑main packages (measured with -coverpkg=./..., -covermode=atomic). The main package is a thin shim delegating to internal packages and is tested via end‑to‑end tests; coverage gating applies to the internal packages that implement all logic.
	•	Idiomatic Go: adhere to standard Go best practices—clean package boundaries, context threading, error wrapping with %w, zero panics outside main, go vet/staticcheck clean, gofumpt formatting, race‑safe concurrency, deterministic output for tests.

# Architecture
	•	Location: tools/validate/ (Go CLI; compiled binary checked into scripts/validate[.exe] for convenience)
	•	CLI Interface: Replace existing scripts to run the Go tool; quiet by default

## CLI (high level)

validate [test|lint|build] [--verbose] [--json] [--no-spinner] [--ci] [--service <name>...]

	•	Quiet by default (minimal summaries, failures inline)
	•	--verbose streams full subprocess output
	•	--json emits machine‑readable summary (for CI and dashboards)
	•	--service filters to specific services
	•	Auto‑detect TTY; disables spinners on CI/when not TTY

## Config

A small repo config at .validate.yaml to declare services and how to run them:

services:
  - name: ui
    type: node
    test: "yarn --cwd ui test --silent --reporters=jest-silent-reporter"
    lint: "yarn --cwd ui lint --quiet"
    build: "yarn --cwd ui build"
  - name: agent-service
    type: node
    test: "yarn --cwd agent-service test --silent --reporters=jest-silent-reporter"
    lint: "yarn --cwd agent-service lint --quiet"
    build: "yarn --cwd agent-service build"
  - name: mcp-service
    type: node
    test: "yarn --cwd mcp-service test --silent --reporters=jest-silent-reporter"
    lint: "yarn --cwd mcp-service lint --quiet"
    build: "yarn --cwd mcp-service build"
  - name: core
    type: go
    dir: "./go/core"
    test:
      cmd: "go test ./... -cover -json"
      coverage_profile: "coverage.out"   # optional; tool can generate if missing
    lint:
      cmd: "golangci-lint run --out-format json"
    build:
      cmd: "go build ./..."

The tool ships with adapters for type: go and type: node to parse outputs and produce consistent summaries.

The tool should allow a directory to set per‑service coverage thresholds for their code (not the tool) via min_coverage: <percent>. The tool still enforces its own 100% internally via CI.

1. Core Dependencies (Go)
	•	Process & Concurrency: stdlib os/exec, context, sync, time
	•	Terminal spinners & UI: github.com/pterm/pterm (spinners, live output, colors)
	•	JSON parsing: stdlib encoding/json
	•	Error group: golang.org/x/sync/errgroup
	•	TTY detection: github.com/mattn/go-isatty
	•	YAML config: gopkg.in/yaml.v3

Quality & idiomatic Go (added):
	•	Linters: golangci-lint with govet, staticcheck, gofumpt, revive, errcheck, ineffassign, misspell, unparam, gosec enabled.
	•	Race detector: go test -race ./... in CI for the tool.
	•	Project layout: logic in internal/... packages; tools/validate/main.go limited to wiring.
	•	Interfaces for testability: wrap os/exec and spinner/TTY behind narrow interfaces; inject clocks and RNG if needed for determinism.

For Node subprojects, keep jest-silent-reporter in those packages. ESLint can run with --quiet and/or a JSON formatter when --json is requested.

2. Default Behavior (Quiet Mode)

All commands run in quiet mode by default:
	•	Spinner per service during execution (disabled on non‑TTY/CI)
	•	Concise summary lines per service:
	•	Tests
    ✓ agent-service: 45 passed, 2 failed (1.2s), 95% coverage
    ✓ api-gateway: 124 passed, 3 failed (2.3s), 81.2% line coverage
	  ✓ logging-service: 45 passed, 2 failed (1.2s), 95% coverage
    ✓ mcp-service: 45 passed, 2 failed (1.2s), 95% coverage
    ✓ meal-service: 45 passed, 2 failed (1.2s), 95% coverage
    ✓ ui: 45 passed, 2 failed (1.2s), 95% coverage
	•	Lint
    ✓ agent-service: 0 errors, 12 warnings
    ✓ api-gateway: 0 errors, 12 warnings
	  ✓ logging-service: 0 errors, 12 warnings
    ✓ mcp-service: 0 errors, 12 warnings
    ✓ meal-service: 0 errors, 12 warnings
    ✓ ui: 0 errors, 12 warnings
	•	Build: 
    ✓ agent-service: build succeeded (5.8s)
    ✓ api-gateway: build succeeded (5.8s)
	  ✓ logging-service: build succeeded (5.8s)
    ✓ mcp-service: build succeeded (5.8s)
    ✓ meal-service: build succeeded (5.8s)
    ✓ ui: build succeeded (5.8s)
	•	Hide stdout/console.log and verbose chatter
	•	On failure: print suite/package and the failing tests; print lints as short bullet items, then the first relevant error block. For build failures, show what is relevant to fix it.

Verbose Mode (--verbose):
	•	Streams full underlying command output in real time
	•	Spinners replaced with simple phase banners
	•	Still prints a final one‑line summary per service

JSON Mode (--json):
	•	Emits structured result objects for each service ({ name, type, phase, duration_ms, status, coverage, failures[] })

3. Script Replacements

Root scripts now call the Go binary (kept in scripts/ for cross‑platform use). Provide a tiny wrapper that builds once if missing:

scripts/validate (bash):

#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="$HERE/validate"
if [ ! -x "$BIN" ]; then
  echo "Building validate..."
  go build -o "$BIN" ./tools/validate
fi
exec "$BIN" "$@"

scripts/validate.cmd (Windows):

@echo off
setlocal
set HERE=%~dp0
set BIN=%HERE%validate.exe
if not exist "%BIN%" (
  echo Building validate...
  go build -o "%BIN%" ./tools/validate
)
"%BIN%" %*

Root package.json changes

{
  "scripts": {
    "test": "scripts/validate test",
    "test:verbose": "scripts/validate test --verbose",
    "lint": "scripts/validate lint",
    "lint:verbose": "scripts/validate lint --verbose",
    "build": "scripts/validate build",
    "build:verbose": "scripts/validate build --verbose"
  }
}

This removes the dependency on concurrently for orchestration—the Go tool runs tasks in parallel.

Sub‑package updates (TypeScript)
	•	Jest: add jest-silent-reporter and set as default reporter in jest.config.js or pass --reporters=jest-silent-reporter via the tool/config
	•	ESLint: prefer --quiet and set format to JSON when the Go tool asks for --json

Go packages
	•	Use go test -json for machine‑readable events
	•	Optional: -coverprofile=coverage.out; the tool can post‑process with go tool cover -func=coverage.out to compute % line coverage

4. Behavior by Command

validate test
	•	Go (type: go)
	•	Runs go test ./... -json [-cover -coverprofile=...]
	•	Parses JSON events to compute: tests passed/failed/skipped, duration, coverage
	•	On failure: list failing packages/tests:
	•	• go/core: TestHandlerTimeout — expected 200 got 504
	•	Node (type: node)
	•	Runs the configured Jest command (defaulting to jest-silent-reporter for quiet); with --json the tool can re‑run tests with --json --outputFile into a temp file to parse
	•	On failure: list failing suites/tests with first error message excerpt

validate lint
	•	Go: expects golangci-lint run --out-format json (or falls back to text and lightly parses)
	•	Node: expects ESLint; quiet by default, JSON when --json
	•	Summarize counts: errors, warnings (per service). Show the first N (e.g., 10) items with file:line: message (rule)

validate build
	•	Go: go build ./... with quiet summary; on verbose, stream compiler output
	•	Node: your yarn build (Vite/Webpack/etc.), quiet by default; verbose streams everything

Parallelism
	•	Services run in parallel per phase using errgroup with a cap (e.g., GOMAXPROCS or configurable --max-parallel); failures don’t abort siblings but do set the final exit code

Exit Codes
	•	Non‑zero if any service fails the phase. Let all services finish before exiting.
	•	Zero otherwise

5. Implementation Details
	•	Adapters: adapter/go and adapter/node implement Runner (test|lint|build), returning a normalized Result
	•	Output filtering: in quiet mode, stream nothing; capture buffers and extract failure blocks (first ~40 lines or until next test)
	•	Coverage:
	•	Go: parse -json events, or read coverage.out + go tool cover -func
	•	Jest: if coverage enabled, read from summary table or coverage-summary.json
	•	Spinners: one spinner per service with status transitions (pending → running → passed/failed)
	•	CI friendliness: --ci disables TTY UI, forces deterministic line summaries, and enables --json
	•	Windows: rely on exec.CommandContext and not on POSIX shells; wrapper .cmd included
	•	Time tracking: measure wall time per service; display (<duration>s) in summaries
	•	Config discovery: look for .validate.yaml at repo root; also support --config <path>

Testability hooks (added):
	•	Wrap command execution in a CommandRunner interface to inject fakes in tests.
	•	Wrap spinner/TTY detection behind an interface with a no‑op test implementation.
	•	Stable sort summaries (by service name) so golden tests don’t flake under concurrency.
	•	Use a Clock interface for timing in tests where timing affects output.

6. Package/Repo Changes
	•	Add tools/validate/ Go module:
	•	main.go (CLI & wiring)
	•	internal/runner/ (shared types)
	•	internal/adapters/{go,node}/
	•	internal/ui/ (spinners, color, formatting)
	•	internal/config/ (YAML)
	•	internal/execx/ (command runner interface + real/fake) (added for testability)
	•	internal/testutil/ (golden helpers, temporary dirs, fakes) (added)
	•	Commit the wrappers in scripts/
	•	Add jest-silent-reporter to TS packages (if not already)
	•	Add golangci-lint config (e.g., .golangci.yml) for Go packages

7. Example Summaries (Quiet Mode)
	•	Passing tests
•	Tests
    ✓ agent-service: 45 passed, 2 failed (1.2s), 95% coverage
    ✓ api-gateway: 124 passed, 3 failed (2.3s), 81.2% line coverage
	  ✓ logging-service: 45 passed, 2 failed (1.2s), 95% coverage
    ✓ mcp-service: 45 passed, 2 failed (1.2s), 95% coverage
    ✓ meal-service: 45 passed, 2 failed (1.2s), 95% coverage
    ✗ ui: 45 passed, 2 failed (1.2s), 95% coverage	•	Failing tests
      • UserController › creates a user
        Expected status 201, received 500 (users.test.ts:42)

      • AuthMiddleware › rejects expired token
        TypeError: Cannot read properties of undefined (reading 'exp')


	•	Lint
✗ mcp-service: 3 errors, 6 warnings.
• src/agent.ts:120:7  no-undef         'window' is not defined
• src/config.ts:18:1  import/no-cycle  Dependency cycle detected (config -> env -> config)
• src/index.ts:9:10   no-unused-vars   'debug' is defined but never used


	•	Build
✓ ui: build succeeded (5.8s).
✗ api-gateway: build failed. whirlywig is undefined

8. CI/CD Compatibility
	•	Use scripts/validate <phase> --ci --json to produce machine‑readable summaries; archive coverage.out and Jest coverage artifacts as usual
	•	Exit code handling aligns with standard CI expectations

Coverage & idiomatic‑Go enforcement for the tool (added):
	•	Coverage gate (tool only):

# ci/check-coverage.sh
set -euo pipefail
go test -race -covermode=atomic -coverpkg=./... -coverprofile=coverage_tool.out ./...
total=$(go tool cover -func=coverage_tool.out | awk '/^total:/ {print $3}')
if [ "$total" != "100.0%" ]; then
  echo "ERROR: validate coverage is $total, must be 100.0%."
  exit 1
fi
	•	Linters & formatting: golangci-lint run (includes gofumpt, govet, staticcheck, gosec); go mod tidy check.

9. Security & Reliability
	•	Respect existing .env and process env pass‑through
	•	Timeouts per service (configurable, default e.g., 10m) with context cancellation
	•	No panics in library code; return wrapped errors
	•	Race‑safe access to shared state; no global mutable singletons

10. Clarifications / Decisions
	•	Scope: Start with Go services and existing TypeScript services (ui/, agent-service/, mcp-service/). Both are first‑class in v1.
	•	Failure output: When tests fail, print the suite/package name and failing tests as bulleted items with the first relevant error excerpt.
	•	Verbose behavior: --verbose streams full underlying command output and disables spinners.
	•	Error surfacing: Failures are printed inline; no external artifacts required (beyond optional coverage files).
	•	Dependencies: It’s acceptable to add pterm (or alternatives), jest-silent-reporter, and golangci-lint configs as needed.
	•	Quality requirement (added): the build tool must sustain 100% coverage across internal packages and pass all idiomatic‑Go linters in CI, at all times.

⸻

# Implementation Plan — Discrete Milestones

Each milestone includes scope, acceptance criteria, and artifacts. Milestones are ordered to maximize early feedback and preserve coverage guarantees.

## Milestone 0 — Project Scaffolding & Quality Gates

Scope
	•	Initialize tools/validate module and internal/... package layout.
	•	Add scripts/validate and scripts/validate.cmd.
	•	Add baseline .golangci.yml with gofumpt, govet, staticcheck, revive, errcheck, ineffassign, misspell, unparam, gosec.
	•	Add internal/execx interface (real + fake), internal/ui spinner interface (real + no‑op), internal/testutil.

Acceptance
	•	main.go compiles; no behavior beyond --help.
	•	All scaffolding packages have unit tests covering all paths.

Artifacts
	•	Repo layout, coverage gate script.

⸻

## Milestone 1 — Config Loader

Scope
	•	Implement internal/config to load and validate .validate.yaml.
	•	Support --config <path>, defaults to repo root.
	•	Validate service types, presence of commands/dirs, and defaults.

Acceptance
	•	Unit tests: success, malformed YAML, unknown type, missing fields.
	•	100% coverage in internal/config (golden files for YAML samples).

Artifacts
	•	internal/config with doc comments and examples; golden test data.

⸻

## Milestone 2 — Runner Contracts & Result Model

Scope
	•	Define internal/runner types: Phase, Result, Failure, Coverage, Runner interface.
	•	Deterministic formatting helpers for summaries.

Acceptance
	•	Unit tests verifying JSON serialization, deterministic string summaries, failure rendering with truncation rules.

Artifacts
	•	internal/runner package fully tested; format snapshots (golden).

⸻

## Milestone 3 — Go Adapter (adapter/go)

Scope
	•	Implement test, lint, build using execx.
	•	Parser for go test -json → pass/fail counts, duration, coverage from events or coverage.out.
	•	Parse golangci-lint JSON → errors/warnings.

Acceptance
	•	Unit tests with faked execx covering: success, failures, timeouts, non‑TTY, coverage file present/absent, -json parse errors.
	•	100% coverage for adapter, including corner cases (empty output, malformed JSON).

Artifacts
	•	internal/adapters/go with parser subpackage and fixtures.

⸻

## Milestone 4 — Node Adapter (adapter/node)

Scope
	•	Implement test, lint, build using configured commands.
	•	For --json, optional re‑run to a temp file and parse Jest JSON; ESLint JSON parsing.
	•	Failure extraction heuristics for quiet mode.

Acceptance
	•	Unit tests with execx fakes: success/failure, JSON on/off, missing reporters, large outputs truncated.
	•	Coverage 100% for adapter and parsers.

Artifacts
	•	internal/adapters/node with parser fixtures (Jest/ESLint).

⸻

## Milestone 5 — Orchestration & Concurrency

Scope
	•	Wire phases in main.go, errgroup concurrency with --max-parallel.
	•	Implement TTY detection, spinners (disabled on --ci/non‑TTY).
	•	Stable, alphabetical summaries; timing via injected Clock.

Acceptance
	•	Integration test (via testscript or temp repos) running mixed Go/Node fake services; verify parallel behavior, ordering, and exit codes.
	•	Unit tests for cancellation/timeouts and partial failure scenarios.
	•	Coverage maintained at 100% for orchestrating packages (logic lives in internal/...; main.go remains thin).

Artifacts
	•	Orchestrator code, testscript specs or end‑to‑end harness.

⸻

## Milestone 6 — CLI Options & JSON Mode

Scope
	•	Implement flags: --verbose, --json, --service, --no-spinner, --ci, --max-parallel.
	•	JSON emission contract documented.

Acceptance
	•	Unit tests for flag parsing (including invalid combos) and JSON schema.
	•	Golden tests for quiet vs verbose output variants.
	•	Coverage remains at 100%.

Artifacts
	•	CLI parser, JSON schema example in README.

⸻

## Milestone 8 — CI Integration & Adoption

Scope
	•	Replace root scripts with scripts/validate in package.json.

Acceptance
	•	Test, build, and lint is green on the mono‑repo with the new tool.
	•	Coverage reports for services still produced as before; tool’s own coverage at 100% gate.

Test Strategy Summary (for the Tool)
	•	Unit tests for every branch in parsers, formatting, and option handling.
	•	Golden tests for quiet/verbose summary lines and failure excerpts. (Just use existing output)
	•	Faked exec to simulate all subprocess behaviors; no network or external tools required.
	•	End‑to‑end tests with ephemeral project trees to validate orchestration and exit codes.
	•	Race tests and deterministic ordering to avoid flakiness.
	•	Coverage gate at 100% across all internal packages, enforced in CI.