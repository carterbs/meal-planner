# Rules
The following rules apply to every service and tool in this repository:
1. Type safety first.  When writing TypeScript, you MUST NEVER use the any type.  Use generics, utility types or the unknown type when necessary and prefer strict typing throughout the codebase.
2. Lint, build and test before committing.  After editing any file you must run the appropriate linting and build commands for that package and ensure they succeed.  After adding functionality you must add or update tests. Tests should not merely increase coverage – they must verify meaningful behaviour and avoid asserting the behaviour of mocks. If you introduce a new module, write tests that exercise its public API against real dependencies or realistic stubs.
3. Enter Plan mode for complex tasks.  Use plan mode (research/plan separation) when tackling unfamiliar tasks.  This means first outlining what you intend to do, validating assumptions, and getting permission from the user before executing code changes.
4. Context hygiene.  Clearly separate different tasks and avoid inadvertently leaking instructions from one task into another. Each CLAUDE.md is scoped to its directory; do not import instructions from other contexts unless explicitly instructed.
5. Always be experimenting. If you discover a better pattern or improvement to the developer experience, document it and update the relevant CLAUDE.md so future agents benefit.
6. Generated code is read‑only. Never edit files in `generated` by hand. Use the provided scripts to regenerate them when the proto definitions change.
7. Keep this document up to date.  If you discover that a command, directory, or workflow has changed, update this CLAUDE.md and the corresponding subdirectory documents.

## General Guidelines
- Avoid using npm.  All JavaScript/TypeScript packages in this monorepo use Yarn workspaces, so use yarn install and yarn workspace <pkg> <command> to run package‑specific scripts.
- If you encounter ambiguous instructions or missing information, document your assumptions and ask clarifying questions.