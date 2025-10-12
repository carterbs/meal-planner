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

Key data structures & fields:
- `meal_plan_status` enum (`draft`, `finalized`, `archived`, `abandoned`) capturing the lifecycle of a plan.
- `meal_slot` enum (`breakfast`, `lunch`, `dinner`) used for slot enforcement and API typing.
- `meal_snapshot` JSONB column holding the point-in-time meal payload (name, effort, ingredients, steps) for each slot while storing `meal_id` for lookups.
- `MealPlan`, `MealPlanItem`, and `MealPlanSummary` proto messages mirroring the DB schema (week boundaries as timestamps, status, version, optional `thread_id`, slot collection) and used directly in Go via type aliases.

Assumption: There is no production data to migrate or preserve. All consumers can be updated at the same time without maintaining backwards compatibility.

Remaining Tasks:

1. **Expose `MealPlan` on the public API**
   - Update `proto/api.proto` so `GetMealPlanResponse` and `GenerateMealPlanResponse` return a single `MealPlan` message (remove `WeeklyMealPlan` from these responses and delete the message if nothing else references it).
   - Remove the `WeeklyMealPlan` helpers in `meal-service/grpc_server.go`; return the DB-backed `MealPlan` directly from `GetMealPlan`/`GenerateMealPlan`/`FinalizeMealPlan`, and delete the legacy conversion code.
   - Regenerate all protobuf bindings (`yarn generate_code` from repo root) and update the API gateway handlers plus any other Go/TypeScript consumers to handle the new `MealPlan` response shape.
   - Ensure end-to-end scripts and automated tests exercise the new response fields (status, version, snapshots) and no longer rely on the deleted `WeeklyMealPlan` structure.

2. **Eliminate legacy identifiers**
   - Delete the `MealPlanIdentifier` message from `proto/api.proto` and rerun code generation so the generated Go/TS packages are updated.
   - Remove the legacy repository surface area: drop `MealPlanIdentifier` aliases/structs from `meal-service/models/mealplan_sql.go`, remove `GetLatestMealPlan`/`GetMealPlanItems`/other legacy signatures from `meal-service/repositories/interfaces.go`, `meal-service/repositories/meal_plan_repository.go`, and regenerate mocks.
   - Rip out any agent or service code paths that still call the legacy methods so the only persistence API is the new `MealPlan` CRUD contract. Update documentation that referenced the old workflow identifier.

3. **Add coverage for the new repository layer**
   - Extend `meal-service/models/mealplan_sql_test.go` (using `sqlmock`) to cover: `InsertMealPlan`, `UpsertMealPlanItems` (including slot uniqueness violations), `UpdateMealPlanStatus` across every enum value (draft→finalized→archived→abandoned), `UpdateMealPlanVersion`, JSON snapshot round-trips (verify stored JSON matches input meal snapshots), and `ListMealPlansInRange` filtering by status.
   - Write migration validation tests that exercise the new schema through `migrations.test`, confirming the enums, constraints, and triggers exist after applying migration 009.
   - Gate the new behavior with the validate tool (`./tools/validate/validate test --json --no-spinner`) so future agents can rely on the suite to catch regressions.

Acceptance Criteria: gRPC/REST consumers receive the canonical `MealPlan` message (no `WeeklyMealPlan` or `MealPlanIdentifier` usage remains), the repository interface exposes only the new CRUD operations, and the expanded test suite enforces the expected database behavior for migration 009 and the meal plan helpers.
