-- Migration 009: Activate meal plans as first-class database entities
-- Rebuild meal_plans and meal_plan_items tables with enhanced schema

-- Drop existing tables to rebuild with new structure
DROP TABLE IF EXISTS meal_plan_items;
DROP TABLE IF EXISTS meal_plans;

-- Create enum types
CREATE TYPE meal_plan_status AS ENUM ('draft', 'finalized', 'archived', 'abandoned');
CREATE TYPE meal_slot AS ENUM ('breakfast', 'lunch', 'dinner');

-- Create updated meal_plans table
CREATE TABLE meal_plans (
    id SERIAL PRIMARY KEY,
    week_start_date TIMESTAMPTZ NOT NULL,
    week_end_date TIMESTAMPTZ NOT NULL,
    status meal_plan_status NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    thread_id TEXT, -- Optional for non-workflow plans
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure unique week boundaries
    CONSTRAINT unique_week_boundaries UNIQUE (week_start_date, week_end_date)
);

-- Create updated meal_plan_items table
CREATE TABLE meal_plan_items (
    id SERIAL PRIMARY KEY,
    meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    day_index SMALLINT NOT NULL CHECK (day_index >= 0 AND day_index <= 6), -- 0=Monday, 6=Sunday
    meal_type meal_slot NOT NULL,
    meal_id INTEGER, -- Optional reference to meals table
    meal_snapshot JSONB NOT NULL, -- Point-in-time meal data (name, effort, ingredients, steps)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure unique slots per plan
    CONSTRAINT unique_meal_slot UNIQUE (meal_plan_id, day_index, meal_type)
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_meal_plans_updated_at
    BEFORE UPDATE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plan_items_updated_at
    BEFORE UPDATE ON meal_plan_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_meal_plans_status_week ON meal_plans (status, week_start_date DESC);
CREATE INDEX idx_meal_plans_week_range ON meal_plans (week_start_date, week_end_date);
CREATE INDEX idx_meal_plans_thread_id ON meal_plans (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_meal_plan_items_meal_id ON meal_plan_items (meal_id) WHERE meal_id IS NOT NULL;
CREATE INDEX idx_meal_plan_items_plan_day ON meal_plan_items (meal_plan_id, day_index);

-- Backfill any existing data from the old structure (if any exists)
-- Note: The old table structure was already dropped, but this serves as documentation
-- for how to migrate data if needed in a future scenario

-- Example backfill logic (commented out since tables were dropped):
-- INSERT INTO meal_plans (thread_id, version, status, week_start_date, week_end_date, created_at)
-- SELECT
--     thread_id,
--     version,
--     'finalized'::meal_plan_status, -- Default existing plans to finalized
--     -- Infer week boundaries from created_at (start of Monday)
--     date_trunc('week', created_at)::timestamptz,
--     (date_trunc('week', created_at) + interval '6 days 23:59:59')::timestamptz,
--     created_at
-- FROM old_meal_plans;

-- INSERT INTO meal_plan_items (meal_plan_id, day_index, meal_type, meal_snapshot, created_at)
-- SELECT
--     mp.id,
--     CASE old_items.day_of_week  -- Convert day_of_week to day_index (0-6)
--         WHEN 'Monday' THEN 0
--         WHEN 'Tuesday' THEN 1
--         WHEN 'Wednesday' THEN 2
--         WHEN 'Thursday' THEN 3
--         WHEN 'Friday' THEN 4
--         WHEN 'Saturday' THEN 5
--         WHEN 'Sunday' THEN 6
--         ELSE 0
--     END,
--     old_items.meal_type::meal_slot,
--     old_items.meal, -- Existing JSONB becomes meal_snapshot
--     old_items.created_at
-- FROM old_meal_plan_items old_items
-- JOIN meal_plans mp ON mp.thread_id = old_items.thread_id;