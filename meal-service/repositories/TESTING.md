# Meal Plan Repository Testing

This document describes the comprehensive test suite for the meal plan functionality.

## Overview

The test suite consists of:

1. **Migration Tests** (`migrations/migrations_test.go`) - Tests for database schema migration 009
2. **Repository Tests** (`repositories/meal_plan_repository_test.go`) - Tests for meal plan CRUD operations
3. **SQL Test Harness** (`testutil/db_harness.go`) - Database testing infrastructure

## Prerequisites

### Database Setup

The tests require a PostgreSQL database named `mealplanner_test`. You can create it using:

```bash
createdb mealplanner_test
```

Or via psql:

```sql
CREATE DATABASE mealplanner_test;
```

### Environment Variables

Set the following environment variables (or use defaults):

```bash
export DB_HOST=localhost      # Default: localhost
export DB_PORT=5432           # Default: 5432
export DB_USER=postgres       # Default: postgres
export DB_PASSWORD=password   # Default: password
export DB_NAME=mealplanner_test  # Default: mealplanner_test
```

## Running Tests

### Run All Tests

```bash
cd meal-service
go test ./migrations ./repositories -v
```

### Run Migration Tests Only

```bash
cd meal-service
go test ./migrations -v
```

### Run Repository Tests Only

```bash
cd meal-service
go test ./repositories -v
```

### Run Specific Test

```bash
cd meal-service
go test ./repositories -v -run TestInsertMealPlan
```

### Skip Integration Tests

Integration tests require a database connection. To skip them (e.g., in CI without a database):

```bash
go test ./migrations ./repositories -short
```

## Test Coverage

### Migration Tests (`migrations/migrations_test.go`)

These tests verify that migration `009_activate_meal_plans.up.sql` correctly:

- **Schema Creation**
  - Creates `meal_plans` table with correct columns
  - Creates `meal_plan_items` table with correct columns

- **Enum Types**
  - Creates `meal_plan_status` enum (draft, finalized, archived, abandoned)
  - Creates `meal_slot` enum (breakfast, lunch, dinner)

- **Indexes**
  - `idx_meal_plans_status_week` - For status and week lookups
  - `idx_meal_plans_week_range` - For date range queries
  - `idx_meal_plans_thread_id` - For thread-based lookups
  - `idx_meal_plan_items_meal_id` - For meal references
  - `idx_meal_plan_items_plan_day` - For day-based queries

- **Triggers**
  - `update_meal_plans_updated_at` - Auto-updates `updated_at` on meal_plans
  - `update_meal_plan_items_updated_at` - Auto-updates `updated_at` on meal_plan_items

- **Constraints**
  - `unique_week_boundaries` - Prevents duplicate week ranges
  - `unique_meal_slot` - Prevents duplicate slots (plan_id + day + meal_type)
  - Day index check constraint (0-6)
  - Cascade delete from meal_plans to meal_plan_items

### Repository Tests (`repositories/meal_plan_repository_test.go`)

These tests verify repository methods for meal plan operations:

#### Create Operations
- **TestInsertMealPlan**
  - Insert with draft status
  - Insert with thread ID
  - Insert with all status types
  - Unique week boundaries constraint

#### Read Operations
- **TestGetMealPlanByID**
  - Retrieve existing meal plan
  - Handle non-existent meal plan

- **TestGetMealPlanByWeek**
  - Retrieve by week start date
  - Handle non-existent week

- **TestListMealPlansInRange**
  - List all plans in date range
  - Filter by status
  - Verify ordering (DESC by week_start_date)
  - Handle empty results

#### Update Operations
- **TestUpdateMealPlanStatus**
  - Update existing plan status
  - Test status transitions (draft → finalized → archived)
  - Test abandoned status
  - Handle non-existent plan

#### Meal Plan Items
- **TestUpsertMealPlanItems**
  - Insert new items
  - Update existing items (delete + insert)
  - Empty list clears all items
  - Items with meal_id reference

- **TestMealPlanItemsOrdering**
  - Verify items are ordered by day_index, then meal_type

#### JSON Handling
- **TestMealPlanItemsJSONRoundTrip**
  - Complex meal with ingredients and steps
  - Empty ingredients and steps
  - Special characters in data

- **TestRawJSONStorage**
  - Direct JSONB storage and retrieval

#### Data Integrity
- **TestMealPlanSummaryItemCount**
  - Item counts in summaries are accurate

- **TestTransactionIsolation**
  - Operations are atomic

- **TestErrorConditions**
  - Non-existent meal plan handling
  - Context cancellation

## Test Patterns

### Database Harness

The `testutil.DBHarness` provides:

- **SetupTestDB(t)** - Creates test database connection with migrations
- **RunMigrations()** - Executes migration SQL files
- **CleanupTables()** - Removes all data from test tables
- **ResetSequences()** - Resets auto-increment sequences
- **AssertTableExists()** - Verifies table creation
- **AssertEnumExists()** - Verifies enum type creation
- **AssertIndexExists()** - Verifies index creation
- **AssertTriggerExists()** - Verifies trigger creation

### Test Data Builders

The `testutil` package provides builders for creating test data:

- **NewMealBuilder()** - Build test meals
- **NewIngredientBuilder()** - Build test ingredients
- **NewStepBuilder()** - Build test recipe steps
- **NewMealPlanItemBuilder()** - Build test meal plan items

### Test Structure

Each test follows this pattern:

```go
func TestFeatureName(t *testing.T) {
    // Setup database
    harness := testutil.SetupTestDB(t)
    err := harness.RunMigrations()
    require.NoError(t, err)
    defer harness.CleanupTables()

    // Create repository
    repo := NewMealPlanRepository(harness.DB)
    ctx := context.Background()

    t.Run("specific scenario", func(t *testing.T) {
        // Arrange
        // ... setup test data

        // Act
        // ... call repository method

        // Assert
        // ... verify results
    })
}
```

## Continuous Integration

To run tests in CI environments:

```bash
# Start PostgreSQL (if not already running)
docker run -d --name postgres-test \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=mealplanner_test \
  -p 5432:5432 \
  postgres:15

# Wait for database to be ready
sleep 5

# Run tests
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=password
export DB_NAME=mealplanner_test

go test ./migrations ./repositories -v

# Cleanup
docker stop postgres-test
docker rm postgres-test
```

## Troubleshooting

### "connection refused" Error

Ensure PostgreSQL is running and accessible:

```bash
pg_isready -h localhost -p 5432
```

### "database does not exist" Error

Create the test database:

```bash
createdb mealplanner_test
```

### "permission denied" Error

Ensure your database user has necessary permissions:

```sql
GRANT ALL PRIVILEGES ON DATABASE mealplanner_test TO postgres;
```

### Tests Fail on Migration

The test database may have old schema. Drop and recreate:

```bash
dropdb mealplanner_test
createdb mealplanner_test
```

## Best Practices

1. **Isolation** - Each test is isolated using `defer harness.CleanupTables()`
2. **Transaction Safety** - Repository operations use transactions
3. **Error Handling** - All error cases are tested
4. **Data Integrity** - Constraints and triggers are verified
5. **Performance** - Indexes are tested for existence
6. **Realistic Data** - Tests use realistic meal data with ingredients and steps

## Future Enhancements

Potential areas for additional testing:

- Concurrent access testing
- Performance/load testing with large datasets
- Migration rollback testing
- Complex query performance testing
- Edge cases for date boundaries (DST, leap years)
