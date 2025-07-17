-- Drop dependent table first (due to foreign key constraint)
DROP TABLE IF EXISTS agent_messages;
-- Drop the main table
DROP TABLE IF EXISTS agent_sessions;
