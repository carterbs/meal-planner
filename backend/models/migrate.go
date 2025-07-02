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

	tables := []string{mealTable, ingredientTable}
	indexes := []string{}

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
