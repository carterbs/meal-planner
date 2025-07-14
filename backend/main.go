package main

import (
	"database/sql"
	"flag"
	"fmt"
	"net"
	"os"
	"time"

	"mealplanner/db"
	apipb "mealplanner/generated/go"
	"mealplanner/handlers"
	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/services"

	"github.com/joho/godotenv"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

var mainLogger = logging.GetLogger("main")

// HTTP server components removed - all HTTP traffic now handled by API Gateway

func main() {
	// Load env variables from .env file automatically
	if err := godotenv.Load(); err != nil {
		fmt.Println("⚠️  No .env file found, proceeding with existing env variables")
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

	// HTTP server removed - all HTTP traffic now goes through API Gateway

	// Database health checking removed - handled by gRPC HealthCheck endpoint

	// Start gRPC server (HTTP server removed as part of gRPC migration)
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		mainLogger.Fatalw("Failed to listen on gRPC port", "error", err)
	}

	grpcServer := grpc.NewServer()

	// Register our main service
	mealPlannerService := &MealPlannerGRPCServer{}
	apipb.RegisterMealPlannerAPIServer(grpcServer, mealPlannerService)

	// Register health check service
	healthServer := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)

	// Set health status based on database connectivity
	var healthStatus grpc_health_v1.HealthCheckResponse_ServingStatus
	if connection != nil {
		if err := connection.Ping(); err == nil {
			healthStatus = grpc_health_v1.HealthCheckResponse_SERVING
			mainLogger.Info("Health check: Database connected - service SERVING")
		} else {
			healthStatus = grpc_health_v1.HealthCheckResponse_NOT_SERVING
			mainLogger.Warn("Health check: Database ping failed - service NOT_SERVING")
		}
	} else {
		healthStatus = grpc_health_v1.HealthCheckResponse_NOT_SERVING
		mainLogger.Warn("Health check: No database connection - service NOT_SERVING")
	}

	healthServer.SetServingStatus("mealplanner.api.MealPlannerAPI", healthStatus)
	healthServer.SetServingStatus("", healthStatus) // Overall server health

	// Start periodic health check monitoring in background
	go func() {
		ticker := time.NewTicker(30 * time.Second) // Check every 30 seconds
		defer ticker.Stop()

		for range ticker.C {
			var currentStatus grpc_health_v1.HealthCheckResponse_ServingStatus
			if handlers.DB != nil {
				if err := handlers.DB.Ping(); err == nil {
					currentStatus = grpc_health_v1.HealthCheckResponse_SERVING
				} else {
					currentStatus = grpc_health_v1.HealthCheckResponse_NOT_SERVING
					mainLogger.Warnw("Health check: Database ping failed", "error", err)
				}
			} else {
				currentStatus = grpc_health_v1.HealthCheckResponse_NOT_SERVING
				mainLogger.Warn("Health check: No database connection")
			}

			// Update health status if it changed
			healthServer.SetServingStatus("mealplanner.api.MealPlannerAPI", currentStatus)
			healthServer.SetServingStatus("", currentStatus)
		}
	}()

	mainLogger.Info("gRPC server starting on :50051 (HTTP server removed, health checks enabled)")
	if err := grpcServer.Serve(lis); err != nil {
		mainLogger.Fatalw("Error starting gRPC server", "error", err)
	}
}
