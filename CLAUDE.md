# Rules
The following rules apply to every service and tool in this repository:
1. Type safety first.  When writing TypeScript, you MUST NEVER use the any type.  Use generics, utility types or the unknown type when necessary and prefer strict typing throughout the codebase.
2. Use the validate tool for all testing, linting, and building.  Run `tools/validate/validate test|lint|build` before committing. Add meaningful tests that verify behavior, not just coverage.
3. Enter Plan mode for complex tasks.  Use plan mode (research/plan separation) when tackling unfamiliar tasks.  This means first outlining what you intend to do, validating assumptions, and getting permission from the user before executing code changes.
4. Context hygiene.  Clearly separate different tasks and avoid inadvertently leaking instructions from one task into another. Each CLAUDE.md is scoped to its directory; do not import instructions from other contexts unless explicitly instructed.
5. Always be experimenting. If you discover a better pattern or improvement to the developer experience, document it and update the relevant CLAUDE.md so future agents benefit.
6. Generated code is read‑only. Never edit files in `generated` by hand. Use the provided scripts to regenerate them when the proto definitions change.
7. Keep this document up to date.  If you discover that a command, directory, or workflow has changed, update this CLAUDE.md and the corresponding subdirectory documents.

## Validate Tool Usage

Use the unified validate tool for consistent testing, linting, and building across all services:

- **Run all operations**: `tools/validate/validate test|lint|build`
- **Target specific services**: `tools/validate/validate test --service ui --service meal-service`
- **Verbose output**: `tools/validate/validate test --verbose`
- **CI mode**: `tools/validate/validate test --ci --json`

The tool automatically detects service types (Go/Node) and runs appropriate commands with minimal output by default.

## General Guidelines
- Avoid using npm.  All JavaScript/TypeScript packages in this monorepo use Yarn workspaces, so use yarn install and yarn workspace <pkg> <command> to run package‑specific scripts.
- If you encounter ambiguous instructions or missing information, document your assumptions and ask clarifying questions.