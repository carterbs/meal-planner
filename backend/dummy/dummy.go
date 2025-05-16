package dummy

import (
	"encoding/csv"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"

	"mealplanner/models"
)

var meals []*models.Meal

// Load reads meals from a CSV file (same format used for seeding)
func Load(csvPath string) error {
	file, err := os.Open(csvPath)
	if err != nil {
		return err
	}
	defer file.Close()
	r := csv.NewReader(file)
	records, err := r.ReadAll()
	if err != nil {
		return err
	}
	if len(records) <= 1 {
		return nil
	}
	records = records[1:]
	mealMap := map[string]*models.Meal{}
	for _, rec := range records {
		if len(rec) < 3 {
			continue
		}
		name := rec[0]
		ingredientField := rec[1]
		effort, _ := strconv.Atoi(rec[2])
		m, ok := mealMap[name]
		if !ok {
			m = &models.Meal{
				ID:             len(mealMap) + 1,
				MealName:       name,
				RelativeEffort: effort,
				RedMeat:        isRedMeat(name),
				Ingredients:    []models.Ingredient{},
				Steps:          []models.Step{},
			}
			mealMap[name] = m
			meals = append(meals, m)
		}
		qty, unit, ingName := parseIngredient(ingredientField)
		qtyF, _ := strconv.ParseFloat(qty, 64)
		m.Ingredients = append(m.Ingredients, models.Ingredient{
			ID:       len(m.Ingredients) + 1,
			MealID:   m.ID,
			Quantity: qtyF,
			Unit:     unit,
			Name:     ingName,
		})
	}
	return nil
}

// GetAllMeals returns all loaded meals
func GetAllMeals() ([]*models.Meal, error) {
	return meals, nil
}

// GetMealsByIDs returns meals matching the given IDs
func GetMealsByIDs(ids []int) ([]*models.Meal, error) {
	var out []*models.Meal
	for _, id := range ids {
		for _, m := range meals {
			if m.ID == id {
				out = append(out, m)
				break
			}
		}
	}
	return out, nil
}

// SwapMeal returns a random meal excluding the given ID
func SwapMeal(currentID int) (*models.Meal, error) {
	if len(meals) == 0 {
		return nil, nil
	}
	rand.Seed(time.Now().UnixNano())
	for i := 0; i < 10; i++ {
		m := meals[rand.Intn(len(meals))]
		if m.ID != currentID {
			return m, nil
		}
	}
	// fallback to first different meal
	for _, m := range meals {
		if m.ID != currentID {
			return m, nil
		}
	}
	return nil, nil
}

// GenerateWeeklyMealPlan creates a simple meal plan using effort ranges
func GenerateWeeklyMealPlan() (map[string]*models.Meal, error) {
	plan := make(map[string]*models.Meal)
	rand.Seed(time.Now().UnixNano())
	redUsed := false

	pick := func(min, max int) *models.Meal {
		filtered := make([]*models.Meal, 0)
		for _, m := range meals {
			if m.RelativeEffort >= min && m.RelativeEffort <= max {
				if redUsed && m.RedMeat {
					continue
				}
				filtered = append(filtered, m)
			}
		}
		if len(filtered) == 0 {
			return nil
		}
		m := filtered[rand.Intn(len(filtered))]
		if m.RedMeat {
			redUsed = true
		}
		return m
	}

	plan["Monday"] = pick(0, 2)
	plan["Tuesday"] = pick(3, 5)
	plan["Wednesday"] = pick(3, 5)
	plan["Thursday"] = pick(3, 5)
	plan["Friday"] = &models.Meal{MealName: "Eating out"}
	plan["Saturday"] = pick(3, 5)
	plan["Sunday"] = pick(6, 100)

	return plan, nil
}

// Helper functions copied from seed.go
func parseIngredient(s string) (string, string, string) {
	tokens := strings.Fields(s)
	if len(tokens) < 3 {
		return "", "", s
	}
	return tokens[0], tokens[1], strings.Join(tokens[2:], " ")
}

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
