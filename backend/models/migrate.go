package models

import "database/sql"

func Migrate(db *sql.DB) error {
	mealTable := `CREATE TABLE IF NOT EXISTS meals (
		id SERIAL PRIMARY KEY,
		meal_name TEXT NOT NULL,
		relative_effort INTEGER NOT NULL,
		last_planned TIMESTAMP,
		red_meat BOOLEAN NOT NULL DEFAULT false
	)`
	ingredientTable := `CREATE TABLE IF NOT EXISTS ingredients (
		id SERIAL PRIMARY KEY,
		meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
		quantity TEXT,
		unit TEXT,
		name TEXT NOT NULL
	)`
	if _, err := db.Exec(mealTable); err != nil {
		return err
	}
	if _, err := db.Exec(ingredientTable); err != nil {
		return err
	}
	return nil
}
