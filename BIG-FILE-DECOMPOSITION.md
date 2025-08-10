## Agent Service decomposition

### Notes
- Use yarn commands; avoid npm
- Keep imports of API types strictly from `@mealplanner/generated`

### Your workflow
- Commands:
  - `yarn test --coverage`
  - `yarn lint --fix` (treat warnings as allowed per repo pre-commit)
- Follow TDD: write tests first, run to red, implement to green, then refactor.


### Principles
- **Fail fast**: no try/catch that swallows errors. Throw typed errors; catch only at boundaries (gRPC/CLI) to translate to transport errors.
- **Single responsibility**: each module owns one concern; avoid god files and hidden control flow.
- **Instrumentation-first**: structured logs using the logging client with `threadId`, `workflow_type`, `step`, and durations.
- **Generated types only**: prefer `@mealplanner/generated` for protocol/state types.
- **TDD**: add/extend tests before each refactor; keep handlers/graph API stable during phases.

### Targets and rationale
- **`agent-service/workflows/meal-planning.ts` (~1.1K LOC)**
  - Mixed concerns: state init, FSM wiring, nodes, persistence, MCP/LLM adapters, prompts, validation, logging.
  - Hidden control flow inside a large `invoke` path; checkpointing scattered.
  - Action: split into orchestrator, typed nodes, adapters, and persistence.

- **`agent-service/main.ts` (~700+ LOC)**
  - Hosts server bootstrap, all gRPC handlers, validation, and shutdown logic.
  - Duplicates `initializeAgent` and mixes callback-with-async patterns.
  - Action: move to `server/` with per-endpoint handlers, central error translation, and graceful shutdown.

- **`agent-service/manager.ts` (~300+ LOC)**
  - Mixes session registry, workflow execution, config building, and error formatting (returns `{ success: false }`).
  - Action: extract session store/service and an executor that throws on error.

- **`agent-service/logging.ts`**
  - Retry + fallback OK, but internal errors get muted. Needs structured context enrichment and clearer boundaries.

- Secondary candidates: `workflows/conversation-handler.ts`, `workflows/factories.ts`, `shared/mcp-types.ts`, `database/*` (row mappers, zod validation), and `langgraph-agent.ts` (CLI loop embedded).

### Proposed module layout
- `agent-service/workflows/meal-planning/`
  - `index.ts`: `MealPlanningWorkflow` orchestrator; exposes `graph` and `getFeedbackHandler()` only.
  - `graph.ts`: `buildGraph(checkpointer, nodes, adapters): WorkflowGraph` with explicit transition map and single checkpoint call sites.
  - `state.ts`: thin adapters around `MealPlanningCheckpointState`; zod validation; conversion helpers.
  - `persistence.ts`: `loadCheckpoint`, `saveCheckpoint` wrapping `DbCheckpointSaver` with typed errors.
  - `errors.ts`: per-node error classes (e.g., `GeneratePlanError`) with context (threadId, step, cause).
  - `logging.ts`: helpers to inject `threadId`, `step`, durations; no console in nodes.
  - `prompts.ts`: move from `workflows/meal-planning-prompts.ts` and keep pure.
  - `adapters/`
    - `mcpClient.ts`: typed wrapper over MCP calls currently in `shared/mcp-types.ts` (remove `any`).
    - `llm.ts`: wrap ChatOpenAI/FakeChatModel with timeouts and safe JSON parsing.
  - `nodes/`
    - `initiate.ts`
    - `generatePlan.ts` (MCP)
    - `optimizePlan.ts` (LLM)
    - `presentPlan.ts`
    - `feedback/analyze.ts` (nano model)
    - `feedback/apply.ts`
    - `feedback/process.ts`
    - `finalize.ts`
    - `shoppingList.ts` (MCP)
    - `validate.ts` (rules from `VALIDATION_CRITERIA`)

- `agent-service/server/`
  - `index.ts`: startServer, health, graceful shutdown; bind service.
  - `wiring.ts`: proto loading and service registration.
  - `validation.ts`: zod schemas for request inputs.
  - `errors.ts`: translate thrown domain errors to gRPC `ServiceError` consistently.
  - `handlers/`
    - `planStart.ts`, `planFeedback.ts`, `planFinalize.ts`, `resumeWorkflow.ts`
    - `startAgentWorkflow.ts`, `messageAgent.ts`
    - `workflowStatus.ts` (get/list/cancel/state/abandon)
    - `messages.ts` (get/add)
    - `checkpoints.ts` (get/put/list)
    - `health.ts`

- `agent-service/session/`
  - `sessionStore.ts`: interface + in-memory impl (Map-backed).
  - `sessionService.ts`: lifecycle ops; no graph logic.

- `agent-service/workflow/`
  - `executor.ts`: builds `RunnableConfig`, invokes workflow; throws on error; returns typed result.
  - `registry.ts`: keep, but strengthen types and factory registration.

- `agent-service/logger/`
  - `index.ts`: `Logger` interface, context API.
  - `remoteLogger.ts`, `fileLogger.ts`, `compositeLogger.ts`.

- `agent-service/adapters/mcp/`
  - Replace `shared/mcp-types.ts` `any` usage; add unit tests for tool invocation/shape.

- `agent-service/bin/cli.ts`
  - Move CLI loop out of `langgraph-agent.ts`. Keep `LangGraphAgent` free of process I/O.

### Error handling policy
- Nodes and services throw typed errors with context; no `{ success: false }` returns from core layers.
- Only boundaries translate: gRPC handlers map to `ServiceError`.
- Checkpoint persistence: on error, do not persist partial state; surface cause.
- Add timeouts for MCP/LLM calls; throw `ExternalServiceTimeoutError` with operation metadata.

### Current status
- Workflow nodes extracted and tested: `initiate`, `generatePlan`, `optimizePlan`, `presentPlan`, `finalizePlan`, `generateShoppingList`, `feedback/analyze`, `feedback/apply`.
- Persistence/state helpers extracted and tested: `workflows/meal-planning/persistence.ts`, `workflows/meal-planning/state.ts`.
- Orchestrator `workflows/meal-planning.ts` now delegates directly to extracted nodes via top-level imports; legacy compatibility wrappers and the `__keepReferences` shim have been removed.
- Server split scaffolding started: `server/handlers/planStart.ts`, `server/wiring.ts`, `server/index.ts` with tests for `planStart`.
- All `agent-service` tests are green and the build is clean.

### Next steps (priority order)
1) Server split
   - Move gRPC handlers into `server/handlers/*`; centralize error translation and validation.
   - Keep existing exports in `main.ts` as thin re-exports during migration.
   - Add tests per handler (validation, error mapping, happy/edge).

2) Manager/session
   - Create `session/*` and `workflow/executor.ts`; refactor `WorkflowManager` to delegate.
   - Change error returns to throws; update handlers to catch at boundary.
   - Add unit tests for session lifecycle and executor error propagation.

3) Logging/context
   - Introduce `logger/*`; enrich logs with context and durations; remove raw console.
   - Ensure logs include `threadId`, `workflow_type`, `step`, and timing for node calls.

4) MCP typing
   - Replace `any` in `shared/mcp-types.ts` with typed client; move to `adapters/mcp/`.
   - Update nodes to depend on the typed adapter and add unit tests for tool shapes/timeouts.

5) Cleanup
   - Delete dead code, remove duplicated `initializeAgent`, update imports.
   - Extract `graph.ts` under `workflows/meal-planning/` with explicit transition map and single checkpoint call sites.
   - Target `workflows/meal-planning.ts` ≤ 200 LOC, acting as a thin orchestrator only.

### Test plan
- Shoot for 100% coverage.
- Delete existing tests that duplicate new test coverage.
- Tests should live alongside the code they're testing, not in a separate  folder.
- Nodes: happy-path and error/timeout per node; snapshot prompts.
- Graph: transition table tests; checkpoint save-on-success only.
- Handlers: request validation, error mapping; in-process gRPC tests.
- Manager/executor: throws vs. success; config assembly; session lifecycle.
- MCP/LLM adapters: timeout, parsing, shape validation.
- Logger: context fields present; file fallback on remote failure.

### Definition of done
- All `agent-service` tests green; coverage for all modules near 100%.
- No swallowed errors in core/graph/nodes/manager; only boundary translation remains.
- `workflows/meal-planning.ts` ≤ 200 LOC, acting as thin orchestrator.
- `main.ts` ≤ 150 LOC, delegating to `server/*`.
- Lint passes: `yarn lint --fix`. CI: `yarn test --coverage`.

