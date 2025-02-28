-- Add URL field to meals table
ALTER TABLE meals ADD COLUMN IF NOT EXISTS url TEXT;