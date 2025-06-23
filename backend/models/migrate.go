package models

import "database/sql"

func Migrate(db *sql.DB) error {
	mealTable := `CREATE TABLE IF NOT EXISTS meals (
		id SERIAL PRIMARY KEY,
		meal_name TEXT NOT NULL,
		relative_effort INTEGER NOT NULL,
		last_planned TIMESTAMP,
		red_meat BOOLEAN NOT NULL DEFAULT false,
		url TEXT
	)`
	ingredientTable := `CREATE TABLE IF NOT EXISTS ingredients (
		id SERIAL PRIMARY KEY,
		meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
		quantity TEXT,
		unit TEXT,
		name TEXT NOT NULL
	)`
	
	// Agent session tables
	agentSessionTable := `CREATE TABLE IF NOT EXISTS agent_sessions (
		id SERIAL PRIMARY KEY,
		thread_id TEXT UNIQUE NOT NULL,
		status TEXT NOT NULL DEFAULT 'ACTIVE',
		workflow_type TEXT NOT NULL,
		current_step TEXT,
		meal_plan JSONB,
		shopping_list TEXT,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW()
	)`
	
	agentMessageTable := `CREATE TABLE IF NOT EXISTS agent_messages (
		id SERIAL PRIMARY KEY,
		session_id INTEGER REFERENCES agent_sessions(id) ON DELETE CASCADE,
		thread_id TEXT NOT NULL,
		sender TEXT NOT NULL CHECK (sender IN ('user', 'agent')),
		message TEXT NOT NULL,
		order_index INTEGER NOT NULL,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		UNIQUE(session_id, order_index)
	)`
	
	// Create indexes for better performance
	agentSessionIndexes := `
		CREATE INDEX IF NOT EXISTS idx_agent_sessions_thread_id ON agent_sessions(thread_id);
		CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
	`
	
	agentMessageIndexes := `
		CREATE INDEX IF NOT EXISTS idx_agent_messages_session_id ON agent_messages(session_id);
		CREATE INDEX IF NOT EXISTS idx_agent_messages_thread_id ON agent_messages(thread_id);
		CREATE INDEX IF NOT EXISTS idx_agent_messages_order ON agent_messages(session_id, order_index);
	`

	tables := []string{mealTable, ingredientTable, agentSessionTable, agentMessageTable}
	indexes := []string{agentSessionIndexes, agentMessageIndexes}

	// Create tables
	for _, table := range tables {
		if _, err := db.Exec(table); err != nil {
			return err
		}
	}

	// Create indexes
	for _, index := range indexes {
		if _, err := db.Exec(index); err != nil {
			return err
		}
	}

	return nil
}
