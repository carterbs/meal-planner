-- Add meal_type column to meals table
-- This migration adds support for categorizing meals by type (breakfast, lunch, dinner)
-- All existing meals will be categorized as 'dinner' by default

ALTER TABLE meals 
ADD COLUMN meal_type VARCHAR(20) NOT NULL DEFAULT 'dinner' 
CHECK (meal_type IN ('breakfast', 'lunch', 'dinner'));

-- Update existing meals to explicitly set meal_type as 'dinner'
UPDATE meals SET meal_type = 'dinner' WHERE meal_type IS NULL OR meal_type = '';

-- Add an index for efficient filtering by meal type
CREATE INDEX idx_meals_meal_type ON meals(meal_type);