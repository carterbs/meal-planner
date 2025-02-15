package models

import (
	"bufio"
	"database/sql"
	"encoding/csv"
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

// SeedDB reads the CSV file and seeds the database. It only inserts each meal once.
func SeedDB(db *sql.DB, csvPath string) error {
	file, err := os.Open(csvPath)
	if err != nil {
		return err
	}
	defer file.Close()

	reader := csv.NewReader(bufio.NewReader(file))
	records, err := reader.ReadAll()
	if err != nil {
		return err
	}
	if len(records) < 1 {
		return errors.New("CSV file is empty")
	}

	// Skip header row
	records = records[1:]
	mealMap := make(map[string]int)

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, record := range records {
		if len(record) < 4 {
			continue // skip invalid row
		}
		mealName := record[0]
		ingredientField := record[1]
		relativeEffort, err := strconv.Atoi(record[2])
		if err != nil {
			continue
		}
		lastPlannedStr := record[3]
		var lastPlanned time.Time
		if lastPlannedStr != "" {
			lastPlanned, err = time.Parse("2006-01-02 15:04:05.000000", lastPlannedStr)
			if err != nil {
				lastPlanned = time.Time{}
			}
		}

		mealID, exists := mealMap[mealName]
		if !exists {
			redMeat := isRedMeat(mealName)
			err := tx.QueryRow(
				"INSERT INTO meals (meal_name, relative_effort, last_planned, red_meat) VALUES ($1, $2, $3, $4) RETURNING id",
				mealName, relativeEffort, lastPlanned, redMeat,
			).Scan(&mealID)
			if err != nil {
				return err
			}
			mealMap[mealName] = mealID
		}

		qty, unit, ingName := parseIngredient(ingredientField)
		_, err = tx.Exec(
			"INSERT INTO ingredients (meal_id, quantity, unit, name) VALUES ($1, $2, $3, $4)",
			mealID, qty, unit, ingName,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// parseIngredient attempts to split an ingredient string into quantity, unit, and the remainder of the description.
// For example: "1 cup unsalted butter (2 sticks), at room temperature, plus 1 tablespoon"
// might be parsed as: quantity="1", unit="cup", name="unsalted butter (2 sticks), at room temperature, plus 1 tablespoon".
func parseIngredient(s string) (string, string, string) {
	tokens := strings.Fields(s)
	if len(tokens) < 3 {
		return "", "", s
	}
	return tokens[0], tokens[1], strings.Join(tokens[2:], " ")
}

// isRedMeat determines if a meal is red meat based on keywords in the meal name.
func isRedMeat(mealName string) bool {
	lower := strings.ToLower(mealName)
	keywords := []string{"beef", "steak", "burger", "pork", "ham"}
	for _, kw := range keywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}
