# Agent Service Development Guide

## Generated Code Integration
- Import types from `@mealplanner/generated` for protocol buffer definitions
- Use `MealPlanningCheckpointState` from generated code as the canonical state type
- Leverage generated gRPC service definitions for type-safe service implementations
- Generated types are in `@mealplanner/generated/agent_pb` and `@mealplanner/generated/api_pb`

## Project Structure
- `/workflows/` - LangGraph workflow definitions
- `/database/` - Database models and repositories
- `/shared/` - Shared types and utilities
- `/handlers.ts` - gRPC service handlers
- `/langgraph-agent.ts` - Main LangGraph agent implementation

## Development commands

Run all commands from the repository root using Yarn workspaces:

* `yarn install` – Install dependencies.
* `yarn build` – Compile TypeScript to JavaScript.
* `yarn dev` – Run the gRPC server in watch mode.
* `yarn test` – Execute unit tests with Jest.
* `yarn lint` – Run ESLint and Prettier.
* `docker-compose up agent-service` – Start the service in a container.

When editing code, always run `yarn build`, `yarn lint`, and `yarn test` before committing.

## Implementation guidelines

1. **Never use `any`.**  All functions, parameters and variables must have
   explicit types.  Use generics or `unknown` when interacting with
   untyped libraries.
2. **Use generated types.**  Do not re‑declare types defined in the
   Protobuf or shared modules.  Import them from `generated` or
   `shared`.
3. **Zod validation.**  Validate inputs at the boundary using Zod
   schemas.  Define a schema next to the corresponding gRPC handler and
   derive TypeScript types from the schema.  Do not validate in the
   middle of workflows.
4. **Testing philosophy.**  Write tests for public functions.  Tests
   should exercise the real implementation; avoid asserting on mocks or
   stub behaviour.  When necessary use lightweight stubs that mimic 
   network responses.
5. **Plan mode integration.**  Use plan mode to break complex features
   into research and execution.  For example, when adding a new workflow,
   plan its API signature and graph shape before coding.
6. **Strict linting and formatting.**  ESLint and Prettier are configured
   for this service.  Do not ignore lint rules; update the configuration
   only with explicit permission.
7. **Use generated clients** - Always use generated gRPC clients and Connect RPC clients 
   unless absolutely necessary.
