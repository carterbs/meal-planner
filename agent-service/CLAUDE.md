# Agent Service Development Guide

## Core Principles

### Type Safety
- **NEVER use `any` type** - If you believe you need to cast as `any`, you must justify it with a detailed explanation
- **Prefer generated types** - Use types from `@mealplanner/generated` whenever possible as the single source of truth
- **Use generated clients** - Always use generated gRPC clients and Connect RPC clients unless absolutely necessary

### Generated Code Integration
- Import types from `@mealplanner/generated` for protocol buffer definitions
- Use `MealPlanningCheckpointState` from generated code as the canonical state type
- Leverage generated gRPC service definitions for type-safe service implementations
- Generated types are in `@mealplanner/generated/agent_pb` and `@mealplanner/generated/api_pb`

### Development Commands
- `yarn build` - Compile TypeScript
- `yarn test` - Run Jest tests
- `yarn dev` - Run langgraph agent in development mode
- `yarn dev:grpc` - Run gRPC service in development mode
- `yarn start:grpc` - Run gRPC service in production

### Project Structure
- `/workflows/` - LangGraph workflow definitions
- `/database/` - Database models and repositories
- `/shared/` - Shared types and utilities
- `/handlers.ts` - gRPC service handlers
- `/langgraph-agent.ts` - Main LangGraph agent implementation

### Key Guidelines
- Use Zod schemas for runtime validation
- Follow existing patterns for workflow state management
- Maintain consistency with proto definitions
- Use proper error handling for gRPC services