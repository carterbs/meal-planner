-- Migration 009 rollback: Revert meal plans schema changes

-- Drop triggers
DROP TRIGGER IF EXISTS update_meal_plans_updated_at ON meal_plans;
DROP TRIGGER IF EXISTS update_meal_plan_items_updated_at ON meal_plan_items;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_meal_plans_status_week;
DROP INDEX IF EXISTS idx_meal_plans_week_range;
DROP INDEX IF EXISTS idx_meal_plans_thread_id;
DROP INDEX IF EXISTS idx_meal_plan_items_meal_id;
DROP INDEX IF EXISTS idx_meal_plan_items_plan_day;

-- Drop tables
DROP TABLE IF EXISTS meal_plan_items;
DROP TABLE IF EXISTS meal_plans;

-- Drop enum types
DROP TYPE IF EXISTS meal_slot;
DROP TYPE IF EXISTS meal_plan_status;

-- Recreate original tables (from migration 008)
CREATE TABLE meal_plans (
    id SERIAL PRIMARY KEY,
    thread_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE meal_plan_items (
    id SERIAL PRIMARY KEY,
    meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    meal_type TEXT NOT NULL,
    meal JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);