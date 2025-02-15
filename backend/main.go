package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	"mealplanner/db"
	"mealplanner/handlers"
	"mealplanner/models"

	"github.com/joho/godotenv" // add this import

	"github.com/go-chi/chi/v5"
)

func main() {
	// Load env variables from .env file automatically
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, proceeding with existing env variables")
	}

	seedFlag := flag.Bool("seed", false, "Seed the database using the CSV")
	flag.Parse()

	// Read DB config from env variables (set these in your environment)
	config := db.Config{
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		User:     os.Getenv("DB_USER"),
		Password: os.Getenv("DB_PASSWORD"),
		DBName:   os.Getenv("DB_NAME"),
	}

	connection, err := db.ConnectDB(config)
	if err != nil {
		log.Fatalf("Error connecting to the database: %v", err)
	}
	defer connection.Close()

	// Run migrations
	if err := models.Migrate(connection); err != nil {
		log.Fatalf("Migration error: %v", err)
	}

	// Seed the DB only if the flag is provided
	if *seedFlag {
		if err := models.SeedDB(connection, "Meal_db.csv"); err != nil {
			log.Fatalf("Seeding error: %v", err)
		} else {
			log.Println("Database seeded successfully!")
		}
	}

	// Set database connection in handlers (for simplicity)
	handlers.DB = connection

	// Set up HTTP routes
	r := chi.NewRouter()
	r.Get("/api/mealplan", handlers.GetMealPlan)
	r.Post("/api/mealplan/finalize", handlers.FinalizeMealPlan)
	r.Post("/api/mealplan/swap", handlers.SwapMeal)
	r.Post("/api/shoppinglist", handlers.GetShoppingList)
	r.Get("/api/meals", handlers.GetAllMealsHandler)
	r.Post("/api/meals/swap", handlers.SwapMealHandler)
	r.Put("/api/meals/{mealId}/ingredients/{ingredientId}", handlers.UpdateMealIngredientHandler)
	r.Delete("/api/meals/{mealId}/ingredients/{ingredientId}", handlers.DeleteMealIngredientHandler)

	log.Println("Backend server starting on :8080")
	http.ListenAndServe(":8080", r)
}
