package models

type Ingredient struct {
	ID       int
	MealID   int
	Quantity float64
	Unit     string
	Name     string // e.g., "unsalted butter (2 sticks), at room temperature, plus 1 tablespoon"
}
