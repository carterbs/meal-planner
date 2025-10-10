MCP Meal Planner Refactor Plan
The key goal is that meal plans should be first-class database entities rather than workflow state, enabling direct manipulation via stateless MCP tools.

Optimal MCP Tool Set
Core Meal Planning Tools (7 tools)
createMealPlan - Generate new weekly meal plan with optional constraints
getMealPlan - Retrieve meal plan by ID or current active plan
removeMeal - Remove meal from specific day/slot in plan
replaceMeal - Replace meal with specific alternative
swapMeal - Swap meal for random alternative from same type
finalizeMealPlan - Mark plan as finalized and update last_planned dates
generateShoppingList - Create shopping list from meal plan

Meal Data Tools (3 tools)
getMeals - Query available meals with filtering
getMealDetails - Get full meal info including ingredients/steps
addMeal - Create new meal recipe

Planning Management Tools (2 tools)
getMealPlanHistory - List historical meal plans with date ranges

Backend Wiring Requirements
Database Schema Changes
Activate unused meal_plans and meal_plan_items tables
Add week date tracking (week_start_date, week_end_date)
Fix day_index naming inconsistency
Add proper indexes for MCP query performance

API Layer Updates
New meal plan CRUD endpoints for direct plan manipulation
Date-based plan retrieval endpoints
Plan status management (draft/finalized/archived)

Service Layer Enhancements
Stateless meal plan operations independent of workflow state
Direct database persistence for all plan modifications
Validation logic extraction from LangGraph to reusable functions

Refactor Milestones
Milestone 1: Database Foundations
Goal: Persist meal plans as first-class records with date-aware metadata, lifecycle status, and normalized slot data.

Tasks:

- Ship `meal-service/migrations/009_activate_meal_plans.up.sql` to create enums (`meal_plan_status`: draft/finalized/archived/abandoned, `meal_slot`: breakfast/lunch/dinner), rebuild `meal_plans` with `week_start_date`, `week_end_date`, `status`, `version`, optional `thread_id`, `created_at`, `updated_at`, and rebuild `meal_plan_items` with `day_index` (0-6), `meal_type`, optional `meal_id`, and `meal_snapshot` JSON. Add `updated_at` triggers, unique constraints on `(week_start_date, week_end_date)` and `(meal_plan_id, day_index, meal_type)`, plus indexes on `(status, week_start_date DESC)` and `meal_id`. Provide a down migration that drops the new tables, enums, triggers, and indexes. Backfill legacy rows by renaming `day_of_week`→`day_index`, `meal`→`meal_snapshot`, defaulting `status` to `finalized`, and inferring week dates when possible.
- Update `proto/api.proto` to introduce `MealPlanStatus`, `MealPlan`, `MealPlanItem`, and `MealPlanSummary`, include timestamps/status/version/thread fields, and mark `MealPlanIdentifier` deprecated. Regenerate Go/TS bindings and update gRPC/REST responses (`meal-service/grpc_server.go`, `api-gateway` handlers) to return the new `MealPlan` message.
- Keep proto types canonical in Go (`type MealPlan = apipb.MealPlan`, etc.) while expanding `meal-service/models/mealplan_sql.go` with helpers (`InsertMealPlan`, `GetMealPlanByID`, `GetMealPlanByWeek`, `ListMealPlansInRange`, `UpdateMealPlanStatus`, `UpsertMealPlanItems`) that translate DB rows ↔ proto aliases, marshal/unmarshal `meal_snapshot`, and enforce transactions for writes (week starts Monday UTC).
- Broaden `meal-service/repositories/meal_plan_repository.go` and `meal-service/repositories/interfaces.go` to the new CRUD contract, regenerate mocks, drop reliance on `MealPlanIdentifier`, and adjust any call sites. Update scripts and utilities that referenced old columns (`scripts/e2e_remove_saturday.sh`, `scripts/e2e_backend_meal_replacement.sh`, `scripts/e2e_new_session_shopping_list.sh`, `scripts/e2e_backend_meal_removal.sh`, `scripts/export_meal_plans.py`) to use `day_index`/`meal_snapshot`.
- Add repository & migration tests using the existing SQL harness to cover create/read, slot uniqueness violations, status transitions (including `abandoned`), JSON snapshot round-trips, week-range queries, and migration validation. Update `meal-service/README.md` for the new schema and confirm the UI/e2e flows still work without additional front-end changes.

Acceptance Criteria: Meal plans (and items) can be created, fetched by week or ID, updated via status transitions, and queried by date range directly from the database; generated clients compile with the updated proto; automated tests cover the new schema and repository logic.

Milestone 2: Core MCP Tools (250-300 LOC)
Goal: Implement stateless meal plan manipulation tools

Tasks:

- Implement createMealPlan, getMealPlan, finalizeMealPlan
- Replace workflow-dependent logic with direct database operations
- Add meal plan validation functions (effort distribution, red meat limits)
- Update MCP server with new tool definitions
Files Modified:
mcp-service/src/tools/createMealPlan.ts
mcp-service/src/tools/getMealPlan.ts
mcp-service/src/tools/finalizeMealPlan.ts
mcp-service/src/utils/validation.ts
mcp-service/src/index.ts
Deliverable: Can create, retrieve, and finalize meal plans without workflows. Full unit tests.

Milestone 3: Meal Manipulation Tools (200-250 LOC)
Goal: Enable direct meal plan modifications

Tasks:
- Implement removeMeal, replaceMeal, swapMeal tools
- Add meal plan item management endpoints to API gateway
- Create plan modification validation logic
- Update shopping list generation for modified plans

Files Modified:
mcp-service/src/tools/removeMeal.ts
mcp-service/src/tools/replaceMeal.ts
mcp-service/src/tools/swapMeal.ts
api-gateway/handlers/meal_plan.go
meal-service/grpc_server.go
Deliverable: Can modify individual meals in plans via MCP tools. Full unit test coverage.

Milestone 4: API Layer Refactoring (300-350 LOC)
Goal: Create comprehensive meal plan API endpoints

Tasks:
- Add date-based meal plan endpoints (GET /api/mealplans?week=2025-01-13)
- Implement plan status management (draft/finalized/archived)
- Add meal plan history and cloning endpoints
- Update API documentation and client generation

Files Modified:
api-gateway/main.go
api-gateway/handlers/meal_plan.go
meal-service/grpc_server.go
proto/api.proto
generated/ (auto-generated client code)

Deliverable: Full REST API for meal plan management independent of workflows.  Full unit test coverage.

Milestone 5: MCP Service Completion (150-200 LOC)
Goal: Complete MCP tool set with advanced features

Tasks:

- Implement getMealPlanHistory, cloneMealPlan, getMealDetails
- Add MCP resources for historical plans and meal catalog
- Create tool documentation and validation schemas
- Add comprehensive error handling

Files Modified:

mcp-service/src/tools/getMealPlanHistory.ts
mcp-service/src/tools/getMealDetails.ts
mcp-service/src/resources/
mcp-service/src/schemas/
Deliverable: Complete MCP server with 11 tools and 3 resources

Milestone 6: Agent Service Simplification (200-250 LOC)
Goal: Simplify LangGraph workflow to use MCP tools

Tasks:

- Replace direct backend calls with MCP tool calls in workflow
- Simplify workflow state (remove meal plan storage from checkpoints)
- Update feedback processing to use new meal manipulation tools
- Maintain backward compatibility with existing checkpoints

Files Modified:

agent-service/workflows/meal-planning.ts
agent-service/workflows/meal-planning/nodes/
agent-service/database/checkpoints.ts
agent-service/mcp-client.ts
Deliverable: Simplified workflow that orchestrates MCP tools rather than managing state

Milestone 7: Testing & Documentation (150-200 LOC)
Goal: Ensure reliability and usability

Tasks:

- Add integration tests for MCP tools
- Create MCP client example scripts
- Update AGENTS.md with new architecture
- Create MCP tool reference documentation

Files Modified:

examples/mcp-client/
docs/
AGENTS.md
scripts/benchmark.js
Deliverable: Production-ready MCP server with comprehensive testing
