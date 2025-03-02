-- Add recipe steps table
CREATE TABLE recipe_steps (
    id SERIAL PRIMARY KEY,
    meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meal_id, step_number)
); 