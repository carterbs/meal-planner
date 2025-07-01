# Meal Planner Agent

This module provides a TypeScript implementation of the AI agent that powers meal planning workflows. It is designed as a standalone package within the monorepo (`typescript/agent`) and exposes both a programmatic API and a command line interface for interacting with the agent.

## Agent Architecture

### Components

- **LangGraphAgent** (`langgraph-agent.ts`) – top level façade that exposes convenience methods such as `startWorkflow`, `resumeWorkflow`, and `handleMessage`. It wires together the workflow manager, conversation handler and feedback handler.
- **WorkflowManager** (`manager.ts`) – manages workflow sessions and coordinates execution. It stores active sessions in memory and persists checkpoints to Postgres using `PostgresCheckpointSaver`.
- **WorkflowRegistry** (`registry.ts`) – registry of available workflow factories. Currently only the meal planning workflow is registered but the design allows additional workflows to be plugged in.
- **MealPlanningWorkflow** (`workflows/meal-planning.ts`) – implements the actual meal planning logic. It builds a workflow graph using LangGraph, connects to the Model Context Protocol (MCP) server to call backend tools and uses OpenAI models for optimisation and feedback processing.
- **FeedbackHandler** and **ConversationHandler** (`workflows/*`) – handle user feedback and conversation routing. They update the workflow state and decide how to progress the workflow.
- **IO Handlers** (`io/*`) – abstraction over user interaction channels. The provided `CLIHandler` implements a readline based interface for local usage.

### State Management and Persistence

Each workflow session has a unique `threadId`. The current state of the workflow is stored as a checkpoint in the `workflow_checkpoints` table via `PostgresCheckpointSaver`. In‑memory sessions are kept in `WorkflowManager.activeSessions` for quick access. On startup the manager loads active sessions from the database so the agent can resume previous conversations.

Workflow state types are defined in `shared/types.ts`. Checkpoints contain both the channel values (actual workflow state) and metadata such as the current step and write sets. Checkpoints are retrieved and stored through LangGraph runnable configs so workflows can pause and resume seamlessly.

### Integration with AI/ML Services

The meal planning workflow relies on OpenAI chat models (`ChatOpenAI` and `gpt‑4.1-nano`) for reasoning and natural language generation. It also uses the MCP SDK client to call backend tools for generating meal plans and shopping lists. When running in JSON mode the workflow connects to an already running MCP server; otherwise it can spawn the server using `scripts/start-mcp.js`.

## Conversation & Workflow Management

User messages are handled by `ConversationHandler`. When a message is received it either starts a new workflow or continues an existing one based on the provided thread ID. During the `await_feedback` step the handler routes incoming messages to the `FeedbackHandler`, which appends feedback to the workflow state and resumes execution.

Prompts used during optimisation and feedback application live in `workflows/meal-planning-prompts.ts`. Response generation utilities such as `MessageGenerator` format user facing messages. Context from previous steps is loaded from the checkpoint so that each iteration has access to the entire conversation history.

Errors encountered during workflow execution are logged and surfaced through the return payload (`success: false` with an error message). The manager ensures that sessions are marked inactive when they reach the `complete` step or when a cancellation request is issued.

## Integration Patterns

### Backend API and MCP

The agent communicates with the backend exclusively through the MCP server. The `Client` from `@modelcontextprotocol/sdk` is connected using `StdioClientTransport`. Workflow steps call MCP tools such as `generateMealPlan`, `getMeals`, `finalizeMealPlan` and `generateShoppingList`. Tool results are parsed and transformed into the internal meal plan representation before being stored in the workflow state.

### Data Synchronisation and State Management

State changes are persisted after each significant step so that another process (CLI or HTTP API) can query progress. `LangGraphAgent.getWorkflowState(threadId)` exposes the raw checkpoint values for inspection. Because `WorkflowManager` maintains an in‑memory map of sessions, real‑time updates are available without additional database round trips.

### Real‑time Communication

The CLI uses the `CLIHandler` to interactively prompt the user. For programmatic use the agent supports a JSON mode where all console output is suppressed and only a JSON payload is emitted. This allows the CLI or a HTTP server to consume agent results in real time.

### MCP Integration

MCP calls are synchronous from the agent point of view. The client sends a request to the MCP server and waits for a response which may include errors. Parsing helpers in `shared/mcp-types.ts` provide type safety for these tool results.

## Development & Deployment

### Installation & Setup

```bash
# install workspace dependencies
yarn install
# build TypeScript sources
cd typescript/agent && yarn build
```

Copy `.env.example` to `.env` and provide your `OPENAI_API_KEY` and optional database credentials. By default the CLI connects to `localhost:5432` using database `meal_planner_dev` and user `postgres`.

### Running the Agent

The CLI entry point is `yarn cli` (or `yarn start` to run the LangGraphAgent directly). The repository also provides `scripts/meal-agent.sh` which ensures the agent is built and runs the CLI:

```bash
./scripts/meal-agent.sh plan start
```

### Testing

Unit and integration tests are located under `tests/` and run with Jest:

```bash
yarn test
```

From the repository root this command is executed as part of the global `yarn test` script which also runs backend and frontend tests.

### Debugging

When running the CLI a `cli-debug.log` file is created in the agent directory containing verbose logs. The `--json` flag enables JSON only output which is useful when the agent is invoked by other services.

### Deployment Considerations

The compiled code lives in `typescript/agent/dist`. Ensure the MCP server and PostgreSQL database are reachable in the target environment. Monitor agent logs and database size of the `workflow_checkpoints` table. Active sessions are automatically restored on start so long‑running workflows can be resumed after restarts.

---

This README provides an overview of the agent module’s architecture, interaction flow and development workflow. For a high level view of the entire project see `AGENTS.md` in the repository root.
