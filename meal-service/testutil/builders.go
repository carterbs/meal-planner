package testutil

import (
	apipb "mealplanner/generated/go"
	"mealplanner/models"
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

// WithHasRedMeat sets whether the meal has red meat
func (b *MealBuilder) WithHasRedMeat(hasRedMeat bool) *MealBuilder {
	b.meal.HasRedMeat = hasRedMeat
	return b
}

// WithURL sets the meal URL
func (b *MealBuilder) WithURL(url string) *MealBuilder {
	b.meal.Url = url
	return b
}

// WithIngredients sets the ingredients
func (b *MealBuilder) WithIngredients(ingredients ...*models.Ingredient) *MealBuilder {
	b.meal.Ingredients = ingredients
	return b
}

// WithSteps sets the steps
func (b *MealBuilder) WithSteps(steps ...*models.Step) *MealBuilder {
	b.meal.Steps = steps
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

// WithInstruction sets the instruction
func (b *StepBuilder) WithInstruction(instruction string) *StepBuilder {
	b.step.Instruction = instruction
	return b
}

// Build returns the built step
func (b *StepBuilder) Build() *models.Step {
	return b.step
}

// MealPlanItemBuilder helps create test meal plan item data
type MealPlanItemBuilder struct {
	item *models.MealPlanItem
}

// NewMealPlanItemBuilder creates a new meal plan item builder with default values
func NewMealPlanItemBuilder() *MealPlanItemBuilder {
	return &MealPlanItemBuilder{
		item: &models.MealPlanItem{
			MealPlanId: 1,
			DayIndex:   0,
			MealType:   apipb.MealSlot_MEAL_SLOT_DINNER,
			MealSnapshot: &models.Meal{
				Name:        "Test Meal",
				MealType:    "dinner",
				Effort:      2,
				Ingredients: []*models.Ingredient{},
				Steps:       []*models.Step{},
			},
		},
	}
}

// WithMealPlanID sets the meal plan ID
func (b *MealPlanItemBuilder) WithMealPlanID(id int) *MealPlanItemBuilder {
	b.item.MealPlanId = int32(id)
	return b
}

// WithDayIndex sets the day index (0-6, Monday-Sunday)
func (b *MealPlanItemBuilder) WithDayIndex(dayIndex int) *MealPlanItemBuilder {
	b.item.DayIndex = int32(dayIndex)
	return b
}

// WithMealType sets the meal type slot
func (b *MealPlanItemBuilder) WithMealType(slot apipb.MealSlot) *MealPlanItemBuilder {
	b.item.MealType = slot
	return b
}

// WithMealID sets the optional meal ID reference
func (b *MealPlanItemBuilder) WithMealID(mealID int) *MealPlanItemBuilder {
	mealIDInt32 := int32(mealID)
	b.item.MealId = &mealIDInt32
	return b
}

// WithMealSnapshot sets the meal snapshot
func (b *MealPlanItemBuilder) WithMealSnapshot(meal *models.Meal) *MealPlanItemBuilder {
	b.item.MealSnapshot = meal
	return b
}

// Build returns the built meal plan item
func (b *MealPlanItemBuilder) Build() *models.MealPlanItem {
	return b.item
}
