Agent Service Migration Analysis & Plan

Current Agent Service Structure

1. Test Files (7 comprehensive test suites)

- /typescript/agent/tests/meal-planning.test.ts - Core workflow validation tests
- /typescript/agent/tests/meal-planning.integration.test.ts - Integration tests
- /typescript/agent/tests/meal-planning-workflow-nodes.test.ts - Individual node
 tests
- /typescript/agent/tests/meal-planning-state-management.test.ts - State &
checkpointing
- /typescript/agent/tests/meal-planning-feedback-loop.test.ts - Feedback
processing
- /typescript/agent/tests/meal-planning-message-persistence.test.ts - Message
handling
- /typescript/agent/tests/meal-planning-validation-edge-cases.test.ts - Edge
cases
- /typescript/agent/tests/test-utils.ts - Shared test utilities and mocks
- /typescript/agent/tests/TEST_PLAN.md - Test coverage documentation
- /typescript/agent/tests/__mocks__/cli.ts - CLI mocks

2. Core Agent Infrastructure

- /typescript/agent/langgraph-agent.ts - Main LangGraphAgent class & entry point
- /typescript/agent/manager.ts - WorkflowManager for session lifecycle
- /typescript/agent/registry.ts - WorkflowRegistry for workflow factories
- /typescript/agent/cli.ts - CLI interface with comprehensive JSON/console modes
- /typescript/agent/logging.ts - Structured logging system

3. LangGraph Workflow Implementation

- /typescript/agent/workflows/meal-planning.ts - Core MealPlanningWorkflow
(1,212 lines)
- /typescript/agent/workflows/factories.ts - Workflow factory registration
- /typescript/agent/workflows/conversation-handler.ts - Message routing &
conversation flow
- /typescript/agent/workflows/feedback-handler.ts - User feedback processing
- /typescript/agent/workflows/meal-planning-prompts.ts - LLM prompts

4. State Management & Persistence

- /typescript/agent/shared/httpCheckpointer.ts - HTTP-based checkpoint
persistence
- /typescript/agent/shared/types.ts - TypeScript types & Zod schemas
- /typescript/agent/shared/mcp-types.ts - MCP integration types

5. I/O & Communication

- /typescript/agent/io/cliHandler.ts - Interactive CLI interface
- /typescript/agent/io/ioHandler.ts - I/O abstraction interface

6. Utilities

- /typescript/agent/utils/getBackendClient.ts - gRPC backend client factory
- /typescript/agent/utils/formatMealPlan.ts - Meal plan formatting utilities
- /typescript/agent/utils/messageGenerator.ts - LLM-powered message generation

7. Configuration

- /typescript/agent/package.json - Dependencies (LangChain, LangGraph, OpenAI,
MCP SDK)
- /typescript/agent/jest.config.js - Jest test configuration with ESM support
- /typescript/agent/tsconfig.json - TypeScript configuration

Communication Architecture Analysis

Current Backend Communication:

1. gRPC HTTP/2 via @connectrpc/connect-node to localhost:50051
2. MCP (Model Context Protocol) via stdio transport for tool calls
3. HTTP Checkpointer for workflow state persistence
4. Message API for conversation history storage

Data Flow:

- Agent ↔ Backend: gRPC (checkpoints, messages, workflow status)
- Agent ↔ MCP Server: stdio (meal data, shopping lists, meal plan operations)
- Agent ↔ OpenAI: REST (LLM calls for optimization & feedback analysis)

Implementation Plan

Phase 1
1. Create /agent-service directory in repository root
2. Copy all agent files with preserved structure
3. Update package.json for standalone operation
4. Modify import paths for new structure
5. Update build scripts
6. Test full integration with existing backend (yarn test:e2e)
7. STOP

Phase 2
1. create agent.proto for new agent gRPC service. All endpoint should cover existing functionality in cli.ts
2. create main.ts for the new agent-service. gRPC service should cover all endpoints.
3. Update `yarn start` and `e2e_remove_friday.ts` to start the agent service.
3. Test implementation using yarn test:e2e