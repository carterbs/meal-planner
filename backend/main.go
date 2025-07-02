package main

import (
	"database/sql"
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"

	"mealplanner/db"
	"mealplanner/handlers"
	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/services"

	"github.com/fatih/color"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
)

var mainLogger = logging.GetLogger("main")

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
		if cw.status == http.StatusInternalServerError {
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
		color.Yellow("⚠️  No .env file found, proceeding with existing env variables")
		fmt.Println()
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
		// Try to connect to database, but don't block server startup
		connection, err = db.ConnectDB(config)
	}
	if err != nil {
		if !db.IsConnectionError(err) {
			// Only show fatal errors for config issues, not connection issues
			mainLogger.Fatalw("Error connecting to the database", "error", err)
		}
		// For connection errors, just continue silently with nil DB
	}

	if connection != nil {
		defer connection.Close()

		// Run migrations (only if we have a connection)
		if err := models.Migrate(connection); err != nil {
			mainLogger.Errorw("Migration error", "error", err)
		}

		// Seed the DB only if the flag is provided and we have a connection
		if *seedFlag {
			if err := models.SeedDB(connection, "Meal_db.csv"); err != nil {
				mainLogger.Errorw("Seeding error", "error", err)
			} else {
				mainLogger.Info("Database seeded successfully!")
			}
		}
	}

	// Set database connection in handlers (might be nil if connection failed)
	handlers.DB = connection

	// Always initialize service container when not in dummy mode
	if !*dummyFlag {
		handlers.Services = services.NewServiceContainer(connection)
		// Maintain backward compatibility for existing workflow service usage
		handlers.WorkflowService = handlers.Services.WorkflowService
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

		// If DB is already connected, just confirm it's working
		if handlers.DB != nil {
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

		// Attempt to reconnect to the database with retry logic
		var connection *sql.DB
		var err error
		maxRetries := 5
		retryDelay := time.Duration(500) * time.Millisecond

		for i := 0; i < maxRetries; i++ {
			connection, err = db.ConnectDB(config)
			if err == nil {
				break // Success!
			}

			if !db.IsConnectionError(err) {
				// Non-connection error, don't retry
				break
			}

			if i < maxRetries-1 {
				// Wait before retrying (except on last attempt)
				time.Sleep(retryDelay)
				retryDelay *= 2 // Exponential backoff
			}
		}
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

		// Initialize service container with new connection
		handlers.Services = services.NewServiceContainer(connection)
		// Maintain backward compatibility for existing workflow service usage
		handlers.WorkflowService = handlers.Services.WorkflowService

		// Ensure migrations are up to date
		if err := models.Migrate(connection); err != nil {
			mainLogger.Errorw("Migration error during reconnection", "error", err)
			// We don't fail the reconnect if migrations have issues
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","message":"Successfully reconnected to the database"}`))
	})

	// Register API routes
	r.Get("/api/mealplan", handlers.GetMealPlan)
	r.Post("/api/mealplan/generate", handlers.GenerateMealPlan)
	r.Post("/api/mealplan/finalize", handlers.FinalizeMealPlanHandler)
	r.Get("/api/mealplan/ics", handlers.MealPlanICSHandler)
	r.Post("/api/shoppinglist", handlers.GetShoppingList)
	r.Get("/api/meals", handlers.GetAllMealsHandler)
	r.Post("/api/meals", handlers.CreateMealHandler)
	r.Post("/api/meals/swap", handlers.SwapMealHandler)
	r.Post("/api/meals/remove", handlers.RemoveMealHandler)
	r.Put("/api/meals/{mealId}/ingredients/{ingredientId}", handlers.UpdateMealIngredientHandler)
	r.Delete("/api/meals/{mealId}/ingredients/{ingredientId}", handlers.DeleteMealIngredientHandler)
	r.Delete("/api/meals/{mealId}", handlers.DeleteMealHandler)
	r.Post("/api/mealplan/replace", handlers.ReplaceMealHandler)

	// New routes for recipe steps
	r.Get("/api/meals/{mealId}/steps", handlers.GetStepsHandler)
	r.Post("/api/meals/{mealId}/steps", handlers.AddStepHandler)
	r.Post("/api/meals/{mealId}/steps/bulk", handlers.AddBulkStepsHandler)
	r.Route("/api/agent", func(r chi.Router) {
		r.Post("/start", handlers.StartAgentWorkflow)
		r.Post("/message", handlers.MessageAgentHandler)

		r.Get("/status/{threadId}", handlers.GetWorkflowStatus)
		r.Get("/workflows", handlers.ListWorkflows)
		r.Delete("/workflows/{threadId}", handlers.CancelWorkflow)
	})
	// Workflow management endpoints
	r.Get("/api/workflows/{threadId}", handlers.GetWorkflowState)
	r.Post("/api/workflows/{threadId}/abandon", handlers.AbandonWorkflow)
	r.Post("/api/workflows/{threadId}/messages", handlers.AddMessage)
	r.Put("/api/workflows/{threadId}/state", handlers.UpdateSessionState)
	r.Put("/api/meals/{mealId}/steps/{stepId}", handlers.UpdateStepHandler)
	r.Delete("/api/meals/{mealId}/steps/{stepId}", handlers.DeleteStepHandler)
	r.Put("/api/meals/{mealId}/steps/reorder", handlers.ReorderStepsHandler)
	r.Delete("/api/meals/{mealId}/steps", handlers.DeleteAllStepsHandler)

	mainLogger.Info("Backend server starting on :8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		mainLogger.Fatalw("Error starting server", "error", err)
	}
}
