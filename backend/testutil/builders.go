package testutil

import (
	"time"

	"mealplanner/models"
	apipb "mealplanner/generated/go"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// MealBuilder helps create test meal data
type MealBuilder struct {
	meal *models.Meal
}

// NewMealBuilder creates a new meal builder with default values
func NewMealBuilder() *MealBuilder {
	return &MealBuilder{
		meal: &models.Meal{
			Id:          1,
			Name:        "Test Meal",
			MealType:    "dinner",
			Effort:      2,
			Ingredients: []*models.Ingredient{},
			Steps:       []*models.Step{},
			HasRedMeat:  false,
		},
	}
}

// WithID sets the meal ID
func (b *MealBuilder) WithID(id int) *MealBuilder {
	b.meal.Id = int32(id)
	return b
}

// WithName sets the meal name
func (b *MealBuilder) WithName(name string) *MealBuilder {
	b.meal.Name = name
	return b
}

// WithMealType sets the meal type
func (b *MealBuilder) WithMealType(mealType string) *MealBuilder {
	b.meal.MealType = mealType
	return b
}

// WithEffort sets the effort level
func (b *MealBuilder) WithEffort(level int) *MealBuilder {
	b.meal.Effort = int32(level)
	return b
}

// WithIngredients sets the ingredients
func (b *MealBuilder) WithIngredients(ingredients []*models.Ingredient) *MealBuilder {
	b.meal.Ingredients = ingredients
	return b
}

// WithSteps sets the steps
func (b *MealBuilder) WithSteps(steps []*models.Step) *MealBuilder {
	b.meal.Steps = steps
	return b
}

// WithLastPlanned sets the last planned date
func (b *MealBuilder) WithLastPlanned(date time.Time) *MealBuilder {
	timestamp := timestamppb.New(date)
	b.meal.LastPlanned = timestamp
	return b
}

// Build returns the built meal
func (b *MealBuilder) Build() *models.Meal {
	return b.meal
}

// IngredientBuilder helps create test ingredient data
type IngredientBuilder struct {
	ingredient *models.Ingredient
}

// NewIngredientBuilder creates a new ingredient builder with default values
func NewIngredientBuilder() *IngredientBuilder {
	return &IngredientBuilder{
		ingredient: &models.Ingredient{
			Id:       1,
			Name:     "Test Ingredient",
			Quantity: 1.0,
			Unit:     "cup",
			MealId:   1,
		},
	}
}

// WithID sets the ingredient ID
func (b *IngredientBuilder) WithID(id int) *IngredientBuilder {
	b.ingredient.Id = int32(id)
	return b
}

// WithName sets the ingredient name
func (b *IngredientBuilder) WithName(name string) *IngredientBuilder {
	b.ingredient.Name = name
	return b
}

// WithQuantity sets the quantity
func (b *IngredientBuilder) WithQuantity(quantity float64) *IngredientBuilder {
	b.ingredient.Quantity = quantity
	return b
}

// WithUnit sets the unit
func (b *IngredientBuilder) WithUnit(unit string) *IngredientBuilder {
	b.ingredient.Unit = unit
	return b
}

// WithMealID sets the meal ID
func (b *IngredientBuilder) WithMealID(mealID int) *IngredientBuilder {
	b.ingredient.MealId = int32(mealID)
	return b
}

// Build returns the built ingredient
func (b *IngredientBuilder) Build() *models.Ingredient {
	return b.ingredient
}

// StepBuilder helps create test step data
type StepBuilder struct {
	step *models.Step
}

// NewStepBuilder creates a new step builder with default values
func NewStepBuilder() *StepBuilder {
	return &StepBuilder{
		step: &models.Step{
			Id:          1,
			MealId:      1,
			StepNumber:  1,
			Instruction: "Test instruction",
		},
	}
}

// WithID sets the step ID
func (b *StepBuilder) WithID(id int) *StepBuilder {
	b.step.Id = int32(id)
	return b
}

// WithMealID sets the meal ID
func (b *StepBuilder) WithMealID(mealID int) *StepBuilder {
	b.step.MealId = int32(mealID)
	return b
}

// WithOrder sets the step order
func (b *StepBuilder) WithOrder(order int) *StepBuilder {
	b.step.StepNumber = int32(order)
	return b
}

// WithInstruction sets the instruction
func (b *StepBuilder) WithInstruction(instruction string) *StepBuilder {
	b.step.Instruction = instruction
	return b
}

// Build returns the built step
func (b *StepBuilder) Build() *models.Step {
	return b.step
}

// WeeklyMealPlanBuilder helps create test weekly meal plan data
type WeeklyMealPlanBuilder struct {
	plan *models.WeeklyMealPlan
}

// NewWeeklyMealPlanBuilder creates a new weekly meal plan builder with default values
func NewWeeklyMealPlanBuilder() *WeeklyMealPlanBuilder {
	return &WeeklyMealPlanBuilder{
		plan: &models.WeeklyMealPlan{
			Days: make([]*models.MealPlanEntry, 0),
			ShoppingList: make([]*models.ShoppingListItem, 0),
		},
	}
}

// WithMealPlanEntry adds a meal plan entry to the plan
func (b *WeeklyMealPlanBuilder) WithMealPlanEntry(dayIndex int, mealType string, meal *models.Meal) *WeeklyMealPlanBuilder {
	entry := &models.MealPlanEntry{
		DayIndex: int32(dayIndex),
		MealType: mealType,
		Meal:     meal,
	}
	b.plan.Days = append(b.plan.Days, entry)
	return b
}

// WithBreakfast sets a breakfast meal for a specific day
func (b *WeeklyMealPlanBuilder) WithBreakfast(day int, meal *models.Meal) *WeeklyMealPlanBuilder {
	return b.WithMealPlanEntry(day, "breakfast", meal)
}

// WithLunch sets a lunch meal for a specific day
func (b *WeeklyMealPlanBuilder) WithLunch(day int, meal *models.Meal) *WeeklyMealPlanBuilder {
	return b.WithMealPlanEntry(day, "lunch", meal)
}

// WithDinner sets a dinner meal for a specific day
func (b *WeeklyMealPlanBuilder) WithDinner(day int, meal *models.Meal) *WeeklyMealPlanBuilder {
	return b.WithMealPlanEntry(day, "dinner", meal)
}

// Build returns the built weekly meal plan
func (b *WeeklyMealPlanBuilder) Build() *models.WeeklyMealPlan {
	return b.plan
}

// ShoppingListItemBuilder helps create test shopping list item data
type ShoppingListItemBuilder struct {
	item *models.ShoppingListItem
}

// NewShoppingListItemBuilder creates a new shopping list item builder with default values
func NewShoppingListItemBuilder() *ShoppingListItemBuilder {
	return &ShoppingListItemBuilder{
		item: &models.ShoppingListItem{
			Ingredient: "Test Ingredient",
			Quantity:   "1.0 cup",
			Category:   "",
		},
	}
}

// WithIngredient sets the ingredient name
func (b *ShoppingListItemBuilder) WithIngredient(name string) *ShoppingListItemBuilder {
	b.item.Ingredient = name
	return b
}

// WithQuantity sets the quantity (formatted string)
func (b *ShoppingListItemBuilder) WithQuantity(quantity string) *ShoppingListItemBuilder {
	b.item.Quantity = quantity
	return b
}

// WithCategory sets the category
func (b *ShoppingListItemBuilder) WithCategory(category string) *ShoppingListItemBuilder {
	b.item.Category = category
	return b
}

// Build returns the built shopping list item
func (b *ShoppingListItemBuilder) Build() *models.ShoppingListItem {
	return b.item
}

// APIWeeklyMealPlanBuilder helps create test API weekly meal plan data
type APIWeeklyMealPlanBuilder struct {
	plan *apipb.WeeklyMealPlan
}

// NewAPIWeeklyMealPlanBuilder creates a new API weekly meal plan builder with default values
func NewAPIWeeklyMealPlanBuilder() *APIWeeklyMealPlanBuilder {
	defaultMeal := &apipb.Meal{
		Id:       1,
		Name:     "Test Meal",
		MealType: "dinner",
		Effort:   2,
	}
	
	return &APIWeeklyMealPlanBuilder{
		plan: &apipb.WeeklyMealPlan{
			Days: []*apipb.MealPlanEntry{
				{
					DayIndex: 0,
					MealType: "dinner",
					Meal:     defaultMeal,
				},
			},
			ShoppingList: []*apipb.ShoppingListItem{},
		},
	}
}

// WithMealPlanEntry adds a meal plan entry to the plan
func (b *APIWeeklyMealPlanBuilder) WithMealPlanEntry(dayIndex int, mealType string, meal *apipb.Meal) *APIWeeklyMealPlanBuilder {
	entry := &apipb.MealPlanEntry{
		DayIndex: int32(dayIndex),
		MealType: mealType,
		Meal:     meal,
	}
	b.plan.Days = append(b.plan.Days, entry)
	return b
}

// WithBreakfast sets a breakfast meal for a specific day
func (b *APIWeeklyMealPlanBuilder) WithBreakfast(day int, meal *apipb.Meal) *APIWeeklyMealPlanBuilder {
	return b.WithMealPlanEntry(day, "breakfast", meal)
}

// WithLunch sets a lunch meal for a specific day
func (b *APIWeeklyMealPlanBuilder) WithLunch(day int, meal *apipb.Meal) *APIWeeklyMealPlanBuilder {
	return b.WithMealPlanEntry(day, "lunch", meal)
}

// WithDinner sets a dinner meal for a specific day
func (b *APIWeeklyMealPlanBuilder) WithDinner(day int, meal *apipb.Meal) *APIWeeklyMealPlanBuilder {
	return b.WithMealPlanEntry(day, "dinner", meal)
}

// Build returns the built weekly meal plan
func (b *APIWeeklyMealPlanBuilder) Build() *apipb.WeeklyMealPlan {
	return b.plan
}