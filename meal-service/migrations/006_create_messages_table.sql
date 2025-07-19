-- Create messages table for storing chat messages separately from checkpoints
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    thread_id VARCHAR(255) NOT NULL,
    sender VARCHAR(50) NOT NULL, -- 'user' or 'agent'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for efficient lookups by thread_id
    INDEX idx_messages_thread_id (thread_id),
    -- Index for ordering by creation time
    INDEX idx_messages_created_at (created_at)
);