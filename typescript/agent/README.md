# Meal Planner AI Agent

This module implements the AI driven agent that powers conversational meal planning.
It orchestrates workflows, stores state and integrates with the backend via MCP and
LLM services.

## Agent Architecture

### Core Components

- **LangGraphAgent** – high level entry point used by the CLI and backend API. It
  exposes methods to start or resume workflows and to handle conversation
  messages. Internally it maintains a `WorkflowManager` and `WorkflowRegistry`.
- **WorkflowManager** – manages lifecycle of workflow sessions. It persists state
  using the Postgres based checkpointer and keeps an in-memory map of active
  sessions. Each session tracks the workflow type, participants, current step and
  timestamps.
- **WorkflowRegistry** – registry of workflow factories. Factories create
  `BaseWorkflow` instances (e.g. the `MealPlanningWorkflow`). The registry ensures
  a single instance per workflow session and cleans them up on shutdown.
- **PostgresCheckpointSaver** – persistence layer storing workflow checkpoints in
  `workflow_checkpoints` via a connection pool. It stores serialized channel
  values and metadata so workflows can resume after failures or restarts.
- **Workflows** – graphs that define the logic for a particular task. Currently
  only `MealPlanningWorkflow` is implemented. Workflows expose an `invoke`
  method used by the manager to execute steps. State types are defined under
  `shared/types.ts` and validated with zod.

### State Management and Persistence

Workflow state is stored as JSON in the database after each step. The
`WorkflowManager` loads active sessions on start and uses the checkpointer to
save and restore state. This allows the agent to survive process restarts and to
continue conversations seamlessly. Each workflow step updates the state object
and writes it back through `PostgresCheckpointSaver.put()`.

### Integration with AI/ML Services

The agent relies on OpenAI models via `ChatOpenAI` for plan generation,
optimization and feedback analysis. Fake models are used in tests or when the
`--codex` flag is passed. Real time calls to the backend API are made through the
Model Context Protocol (MCP) client which exposes tools like `generateMealPlan`,
`getMeals` and `generateShoppingList`.

## Conversation & Workflow Management

### Conversation Handling

`ConversationHandler` routes incoming messages. When no thread ID is provided it
creates a new meal planning workflow; otherwise it looks up the current state and
continues the existing workflow. Messages during the `await_feedback` step are
passed to `FeedbackHandler` which appends the feedback to the checkpoint.

### Workflow Execution

`WorkflowManager` drives execution by invoking the workflow graph. The meal
planning workflow progresses through steps:
`initiate → generate_plan → optimize_plan → present_plan → await_feedback →
apply_feedback → finalize_plan → generate_shopping_list → complete`.
The manager updates session metadata and determines when a workflow is complete
or awaiting user input.

### Prompts and Response Generation

Prompts for plan optimization, feedback analysis and shopping list formatting are
located in `workflows/meal-planning-prompts.ts`. Responses for resume and
completion messages use `MessageGenerator` which calls a lightweight LLM to craft
friendly text based on the current state.

### Error Handling

Workflow and conversation handlers use `try/catch` blocks to return structured
`{success, message}` responses. Errors writing to the database or invoking tools
are logged to the console and propagated as failure messages so the caller can
recover or retry.

## Integration Patterns

### Backend API and MCP

The agent does not talk directly to the Go backend. Instead it communicates via
MCP which exposes backend capabilities as tools. The meal planning workflow calls
these tools to obtain meals, save plans and create shopping lists. The MCP client
uses a stdio transport which can connect to a running server or spawn it through
`scripts/start-mcp.js`.

### Data Synchronization

Checkpoints store both the workflow state and metadata such as the last step and
any writes performed. This provides a single source of truth for the agent and
backend. When the backend queries the agent for state it reads from the same
checkpoint table ensuring consistency.

### Real‑Time Communication

The CLI (`io/cliHandler.ts`) demonstrates interactive use. Messages are printed
with timestamps and user input is awaited on stdin. In production the backend API
would call `LangGraphAgent.handleMessage()` and stream responses to the client.

### MCP Integration

Each MCP tool result is parsed from JSON (stripping markdown fences when
necessary). Errors from the MCP server are converted into user friendly messages
and logged for debugging. This decouples the agent logic from the specifics of
the backend implementation.

## Development & Deployment

### Getting Started

1. Install dependencies using `yarn`.
2. Build the TypeScript sources: `yarn workspace meal-planner-agent build` or run
   `yarn test` from the repository root to compile and execute tests.
3. Start the agent with `yarn start` which loads configuration from `.env` and
   connects to the database.
4. Alternatively run `yarn cli` for an interactive terminal demo.

### Testing

Tests live under `tests/` and use Jest. Run the full suite from the repository
root with `yarn test`. Integration tests spin up the agent and mock MCP calls to
verify meal planning behavior and error conditions.

### Configuration and Debugging

Database credentials are supplied via environment variables (`DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME`). Set `DEBUG` flags or use the
`debugLog` helper to print verbose output. The agent can run in a special
`--codex` mode that replaces OpenAI calls with a fake model for offline testing.

### Deployment and Monitoring

Build the module (`yarn build`) and deploy the generated JavaScript along with
the `.env` configuration. Run the agent as a long lived Node process. Monitoring
should track workflow counts, error logs and Postgres connection health via the
`healthCheck` and `getStats` methods on `LangGraphAgent`.

---

This README provides an overview of how the AI agent system works, how it
integrates with the rest of the application and how to develop and deploy it in
production.
