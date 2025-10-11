Before committing code, all build, lint, and test steps must pass.

- Review `meal-service/AGENTS.md` for service-specific guidance (integration tests must stay behind the `integration` build tag; prefer mocks over Docker).
- Integration DB notes live in `meal-service/repositories/TESTING.md`.
- Use the validate tool: `./tools/validate/validate test|lint|build --json --no-spinner`.
