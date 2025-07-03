-- Recreate agent_sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
    id SERIAL PRIMARY KEY,
    thread_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    workflow_type TEXT NOT NULL,
    current_step TEXT,
    meal_plan JSONB,
    shopping_list TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Recreate agent_messages table
CREATE TABLE IF NOT EXISTS agent_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES agent_sessions(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'agent')),
    message TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, order_index)
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_agent_sessions_thread_id ON agent_sessions(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session_id ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_thread_id ON agent_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_order ON agent_messages(session_id, order_index);
