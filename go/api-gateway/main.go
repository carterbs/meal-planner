package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"api-gateway/handlers"
	logging "api-gateway/middleware"
	"mealplanner/proto"
)

type GatewayServer struct {
	logger        *zap.Logger
	backendClient proto.BackendServiceClient
	backendConn   *grpc.ClientConn
	agentClient   proto.AgentServiceClient
	agentConn     *grpc.ClientConn
}

func NewGatewayServer(logger *zap.Logger) (*GatewayServer, error) {
	// Connect to backend gRPC service
	backendURL := os.Getenv("BACKEND_GRPC_URL")
	if backendURL == "" {
		backendURL = "localhost:9090"
	}

	backendConn, err := grpc.NewClient(backendURL, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	backendClient := proto.NewBackendServiceClient(backendConn)

	// Connect to agent gRPC service
	agentURL := os.Getenv("AGENT_GRPC_URL")
	if agentURL == "" {
		agentURL = "localhost:9091"
	}

	agentConn, err := grpc.NewClient(agentURL, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	agentClient := proto.NewAgentServiceClient(agentConn)

	return &GatewayServer{
		logger:        logger,
		backendClient: backendClient,
		backendConn:   backendConn,
		agentClient:   agentClient,
		agentConn:     agentConn,
	}, nil
}

func (s *GatewayServer) Close() error {
	if s.agentConn != nil {
		s.agentConn.Close()
	}
	return s.backendConn.Close()
}

func (s *GatewayServer) setupRoutes() *chi.Mux {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(logging.Logger(s.logger))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Backend API routes
	r.Route("/api", func(r chi.Router) {
		// Meal management
		r.Get("/meals", handlers.GetAllMeals(s.backendClient))
		r.Post("/meals", handlers.CreateMeal(s.backendClient))
		r.Delete("/meals/{id}", handlers.DeleteMeal(s.backendClient))
		r.Post("/meals/swap", handlers.SwapMeal(s.backendClient))
		r.Delete("/meals/{id}/remove", handlers.RemoveMeal(s.backendClient))
		r.Put("/meals/{old_id}/replace/{new_id}", handlers.ReplaceMeal(s.backendClient))

		// Ingredient management
		r.Put("/meals/{meal_id}/ingredients/{ingredient_id}", handlers.UpdateIngredient(s.backendClient))
		r.Delete("/meals/{meal_id}/ingredients/{ingredient_id}", handlers.DeleteIngredient(s.backendClient))

		// Recipe steps management
		r.Get("/meals/{meal_id}/steps", handlers.GetSteps(s.backendClient))
		r.Post("/meals/{meal_id}/steps", handlers.CreateStep(s.backendClient))
		r.Post("/meals/{meal_id}/steps/bulk", handlers.CreateStepsBulk(s.backendClient))
		r.Put("/meals/{meal_id}/steps/{step_id}", handlers.UpdateStep(s.backendClient))
		r.Delete("/meals/{meal_id}/steps/{step_id}", handlers.DeleteStep(s.backendClient))
		r.Put("/meals/{meal_id}/steps/reorder", handlers.ReorderSteps(s.backendClient))
		r.Delete("/meals/{meal_id}/steps", handlers.DeleteAllSteps(s.backendClient))

		// Meal plan management
		r.Get("/mealplan", handlers.GetMealPlan(s.backendClient))
		r.Post("/mealplan/generate", handlers.GenerateMealPlan(s.backendClient))
		r.Post("/mealplan/finalize", handlers.FinalizeMealPlan(s.backendClient))
		r.Get("/mealplan.ics", handlers.GetMealPlanIcs(s.backendClient))

		// Shopping list
		r.Post("/shopping-list", handlers.GenerateShoppingList(s.backendClient))

		// Workflow/Agent management
		r.Post("/agent/start", handlers.StartAgent(s.agentClient))
		r.Post("/agent/message", handlers.SendMessage(s.backendClient))
		r.Get("/agent/status/{thread_id}", handlers.GetWorkflowStatus(s.backendClient))
		r.Get("/agent/workflows", handlers.ListWorkflows(s.backendClient))
		r.Delete("/agent/workflows/{thread_id}", handlers.CancelWorkflow(s.backendClient))

		// Health check for backend
		r.Get("/health/backend", handlers.HealthCheck(s.backendClient))
		r.Post("/reconnect", handlers.ReconnectDatabase(s.backendClient))
	})

	return r
}

func main() {
	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	// Initialize gateway server
	server, err := NewGatewayServer(logger)
	if err != nil {
		logger.Fatal("Failed to create gateway server", zap.Error(err))
	}
	defer server.Close()

	// Setup routes
	r := server.setupRoutes()

	// Start HTTP server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		logger.Info("API Gateway listening", zap.String("port", port))
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	<-c
	logger.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited")
}
