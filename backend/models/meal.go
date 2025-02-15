package models

import "time"

type Meal struct {
	ID             int
	MealName       string
	RelativeEffort int
	LastPlanned    time.Time
	RedMeat        bool
}

// MealColumns defines the column names for Meal queries.
var MealColumns = []string{"id", "meal_name", "relative_effort", "last_planned", "red_meat"}
