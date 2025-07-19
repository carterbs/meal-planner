-- Create meal_plans table
CREATE TABLE meal_plans (
    id SERIAL PRIMARY KEY,
    thread_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create meal_plan_items table
CREATE TABLE meal_plan_items (
    id SERIAL PRIMARY KEY,
    meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    meal_type TEXT NOT NULL,
    meal JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    thread_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
