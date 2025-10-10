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

Tasks:

- Ship `meal-service/migrations/009_activate_meal_plans.up.sql` to create enums (`meal_plan_status`: draft/finalized/archived/abandoned, `meal_slot`: breakfast/lunch/dinner), rebuild `meal_plans` with `week_start_date`, `week_end_date`, `status`, `version`, optional `thread_id`, `created_at`, `updated_at`, and rebuild `meal_plan_items` with `day_index` (0-6), `meal_type`, optional `meal_id`, and `meal_snapshot` JSON. Add `updated_at` triggers, unique constraints on `(week_start_date, week_end_date)` and `(meal_plan_id, day_index, meal_type)`, plus indexes on `(status, week_start_date DESC)` and `meal_id`. Provide a down migration that drops the new tables, enums, triggers, and indexes. Backfill legacy rows by renaming `day_of_week`→`day_index`, `meal`→`meal_snapshot`, defaulting `status` to `finalized`, and inferring week dates when possible.
- Update `proto/api.proto` to introduce `MealPlanStatus`, `MealPlan`, `MealPlanItem`, and `MealPlanSummary`, include timestamps/status/version/thread fields, and mark `MealPlanIdentifier` deprecated. Regenerate Go/TS bindings and update gRPC/REST responses (`meal-service/grpc_server.go`, `api-gateway` handlers) to return the new `MealPlan` message.
- Keep proto types canonical in Go (`type MealPlan = apipb.MealPlan`, etc.) while expanding `meal-service/models/mealplan_sql.go` with helpers (`InsertMealPlan`, `GetMealPlanByID`, `GetMealPlanByWeek`, `ListMealPlansInRange`, `UpdateMealPlanStatus`, `UpsertMealPlanItems`) that translate DB rows ↔ proto aliases, marshal/unmarshal `meal_snapshot`, and enforce transactions for writes (week starts Monday UTC).
- Broaden `meal-service/repositories/meal_plan_repository.go` and `meal-service/repositories/interfaces.go` to the new CRUD contract, regenerate mocks, drop reliance on `MealPlanIdentifier`, and adjust any call sites. Update scripts and utilities that referenced old columns (`scripts/e2e_remove_saturday.sh`, `scripts/e2e_backend_meal_replacement.sh`, `scripts/e2e_new_session_shopping_list.sh`, `scripts/e2e_backend_meal_removal.sh`, `scripts/export_meal_plans.py`) to use `day_index`/`meal_snapshot`.
- Add repository & migration tests using the existing SQL harness to cover create/read, slot uniqueness violations, status transitions (including `abandoned`), JSON snapshot round-trips, week-range queries, and migration validation. Update `meal-service/README.md` for the new schema and confirm the UI/e2e flows still work without additional front-end changes.

Acceptance Criteria: Meal plans (and items) can be created, fetched by week or ID, updated via status transitions, and queried by date range directly from the database; generated clients compile with the updated proto; automated tests cover the new schema and repository logic.
