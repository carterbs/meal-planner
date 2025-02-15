package models

import "time"

type Meal struct {
	ID             int
	MealName       string
	RelativeEffort int
	LastPlanned    time.Time
	RedMeat        bool
}
