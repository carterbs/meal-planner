package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"mealplanner/db"
	"mealplanner/dummy"
	"mealplanner/handlers"
	"mealplanner/models"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
)

// CustomErrorWriter implements http.ResponseWriter and adds custom error handling
type CustomErrorWriter struct {
	http.ResponseWriter
	status int
}

func (w *CustomErrorWriter) WriteHeader(statusCode int) {
	w.status = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *CustomErrorWriter) Write(b []byte) (int, error) {
	return w.ResponseWriter.Write(b)
}

// DBErrorMiddleware checks for database connection errors and provides helpful messages
func DBErrorMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cw := &CustomErrorWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(cw, r)

		// If we got an internal server error, check if it might be a DB connection issue
		if cw.status == http.StatusInternalServerError && !handlers.UseDummy {
			// This is a bit of a hack, but for demo purposes it's fine.
			// In a real app, we would need to capture the error from the handler.
			if handlers.DB == nil || handlers.DB.Ping() != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusServiceUnavailable)
				errorMessage := `{"error": "Database connection issue. Please make sure Docker is running and the database container is started."}`
				w.Write([]byte(errorMessage))
				return
			}
		}
	})
}

func main() {
	// Load env variables from .env file automatically
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, proceeding with existing env variables")
	}

	seedFlag := flag.Bool("seed", false, "Seed the database using the CSV")
	dummyFlag := flag.Bool("dummy", false, "Use in-memory dummy data instead of a database")
	flag.Parse()

	// Read DB config from env variables with reasonable defaults
	config := db.DefaultConfig()
	if os.Getenv("DB_HOST") != "" {
		config.Host = os.Getenv("DB_HOST")
	}
	if os.Getenv("DB_PORT") != "" {
		config.Port = os.Getenv("DB_PORT")
	}
	if os.Getenv("DB_USER") != "" {
		config.User = os.Getenv("DB_USER")
	}
	if os.Getenv("DB_PASSWORD") != "" {
		config.Password = os.Getenv("DB_PASSWORD")
	}
	if os.Getenv("DB_NAME") != "" {
		config.DBName = os.Getenv("DB_NAME")
	}

	var connection *sql.DB
	var err error
	if !*dummyFlag {
		// Attempt to connect to the database with helpful error messaging
		connection, err = db.ConnectDB(config)
	}
	if err != nil {
		if db.IsConnectionError(err) {
			fmt.Println("\n-------------------------------------------------------------")
			fmt.Println("❌ DATABASE CONNECTION ERROR")
			fmt.Println("-------------------------------------------------------------")
			fmt.Println("Could not connect to the PostgreSQL database.")
			fmt.Println("\n🔍 TROUBLESHOOTING STEPS:")
			fmt.Println("1. Make sure Docker is running on your system")
			fmt.Println("2. Check if the database container is started:")
			fmt.Println("   $ docker ps | grep postgres")
			fmt.Println("3. If not running, start it with:")
			fmt.Println("   $ docker-compose up -d")
			fmt.Println("\n🚨 Error details:", err)
			fmt.Println("-------------------------------------------------------------")

			// Continue execution with nil DB - the middleware will handle errors
			// This allows the frontend to at least load and show appropriate errors
			log.Println("Starting with nil database connection. API calls will return connection errors.")
		} else {
			log.Fatalf("Error connecting to the database: %v", err)
		}
	}

	if connection != nil {
		defer connection.Close()

		// Run migrations (only if we have a connection)
		if err := models.Migrate(connection); err != nil {
			log.Printf("Migration error: %v", err)
		}

		// Seed the DB only if the flag is provided and we have a connection
		if *seedFlag {
			if err := models.SeedDB(connection, "Meal_db.csv"); err != nil {
				log.Printf("Seeding error: %v", err)
			} else {
				log.Println("Database seeded successfully!")
			}
		}
	}

	// Set database connection in handlers (might be nil if connection failed)
	handlers.DB = connection
	if connection == nil || *dummyFlag {
		handlers.UseDummy = true
		if err := dummy.Load("Meal_db.csv"); err != nil {
			log.Fatalf("Failed to load dummy data: %v", err)
		}
		if connection == nil {
			log.Println("Running in dummy data mode (database unavailable)")
		} else {
			log.Println("Running in dummy data mode (forced)")
		}
	}

	// Set up HTTP routes with Chi router
	r := chi.NewRouter()

	// Add middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(DBErrorMiddleware)

	// Enable CORS for development
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// Special endpoint to check database connectivity
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if handlers.UseDummy {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok","message":"Running with dummy data"}`))
			return
		}

		if handlers.DB == nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status":"error","message":"Database not connected. Make sure Docker is running and the database container is started."}`))
			return
		}

		if err := handlers.DB.Ping(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status":"error","message":"Database connection lost. Make sure Docker is running and the database container is started."}`))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","message":"Database connection is healthy"}`))
	})

	// Add endpoint to reconnect to the database
	r.Post("/api/reconnect", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// If DB is already connected and not in dummy mode, just confirm it's working
		if handlers.DB != nil && !handlers.UseDummy {
			if err := handlers.DB.Ping(); err == nil {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`{"status":"ok","message":"Database connection is already established and healthy"}`))
				return
			}

			// If we have a DB object but ping fails, close it before reconnecting
			handlers.DB.Close()
		}

		// Read DB config from env variables with reasonable defaults
		config := db.DefaultConfig()
		if os.Getenv("DB_HOST") != "" {
			config.Host = os.Getenv("DB_HOST")
		}
		if os.Getenv("DB_PORT") != "" {
			config.Port = os.Getenv("DB_PORT")
		}
		if os.Getenv("DB_USER") != "" {
			config.User = os.Getenv("DB_USER")
		}
		if os.Getenv("DB_PASSWORD") != "" {
			config.Password = os.Getenv("DB_PASSWORD")
		}
		if os.Getenv("DB_NAME") != "" {
			config.DBName = os.Getenv("DB_NAME")
		}

		// Attempt to reconnect to the database
		connection, err := db.ConnectDB(config)
		if err != nil {
			if db.IsConnectionError(err) {
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(`{"status":"error","message":"Failed to reconnect to database. Make sure Docker is running and the database container is started."}`))
				return
			}
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(fmt.Sprintf(`{"status":"error","message":"Database reconnection failed: %s"}`, err.Error())))
			return
		}

		// Update the global DB connection
		handlers.DB = connection
		handlers.UseDummy = false

		// Ensure migrations are up to date
		if err := models.Migrate(connection); err != nil {
			log.Printf("Migration error during reconnection: %v", err)
			// We don't fail the reconnect if migrations have issues
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","message":"Successfully reconnected to the database"}`))
	})

	// Register API routes
	r.Get("/api/mealplan", handlers.GetMealPlan)
	r.Post("/api/mealplan/generate", handlers.GenerateMealPlan)
	r.Post("/api/mealplan/finalize", handlers.FinalizeMealPlanHandler)
	r.Post("/api/mealplan/swap", handlers.SwapMeal)
	r.Post("/api/shoppinglist", handlers.GetShoppingList)
	r.Get("/api/meals", handlers.GetAllMealsHandler)
	r.Post("/api/meals", handlers.CreateMealHandler)
	r.Post("/api/meals/swap", handlers.SwapMealHandler)
	r.Put("/api/meals/{mealId}/ingredients/{ingredientId}", handlers.UpdateMealIngredientHandler)
	r.Delete("/api/meals/{mealId}/ingredients/{ingredientId}", handlers.DeleteMealIngredientHandler)
	r.Delete("/api/meals/{mealId}", handlers.DeleteMealHandler)
	r.Post("/api/mealplan/replace", handlers.ReplaceMealHandler)

	// New routes for recipe steps
	r.Get("/api/meals/{mealId}/steps", handlers.GetStepsHandler)
	r.Post("/api/meals/{mealId}/steps", handlers.AddStepHandler)
	r.Post("/api/meals/{mealId}/steps/bulk", handlers.AddBulkStepsHandler)
	r.Put("/api/meals/{mealId}/steps/{stepId}", handlers.UpdateStepHandler)
	r.Delete("/api/meals/{mealId}/steps/{stepId}", handlers.DeleteStepHandler)
	r.Put("/api/meals/{mealId}/steps/reorder", handlers.ReorderStepsHandler)
	r.Delete("/api/meals/{mealId}/steps", handlers.DeleteAllStepsHandler)

	log.Println("Backend server starting on :8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
