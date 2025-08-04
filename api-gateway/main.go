package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	httpSwagger "github.com/swaggo/http-swagger"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	logger "logging-service/client/go"
	apipb "mealplanner/generated/go"
	agentpb "mealplanner/generated/go/agent"
)

// @title Meal Planner API Gateway
// @version 1.0
// @description API Gateway for Meal Planner service
// @termsOfService http://swagger.io/terms/
// @contact.name API Support
// @contact.url http://www.swagger.io/support
// @contact.email support@swagger.io
// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html
// @host localhost:8090
// @BasePath /api

// ErrorResponse is the only custom response type we need
type ErrorResponse struct {
	Error string `json:"error"`
}

var grpcLogger *logger.LoggingClient
var mealPlannerClient apipb.MealPlannerAPIClient

// Gateway represents the API Gateway server
type Gateway struct {
	backend apipb.MealPlannerAPIClient
	agent   agentpb.AgentServiceClient
}

// NewGateway creates a new Gateway instance
func NewGateway(backend apipb.MealPlannerAPIClient, agent agentpb.AgentServiceClient) *Gateway {
	return &Gateway{backend: backend, agent: agent}
}

// httpStatusFromGRPC converts gRPC status codes to HTTP status codes
func httpStatusFromGRPC(err error) int {
	if err == nil {
		return http.StatusOK
	}

	st, ok := status.FromError(err)
	if !ok {
		return http.StatusInternalServerError
	}

	switch st.Code() {
	case codes.OK:
		return http.StatusOK
	case codes.InvalidArgument:
		return http.StatusBadRequest
	case codes.NotFound:
		return http.StatusNotFound
	case codes.AlreadyExists:
		return http.StatusConflict
	case codes.PermissionDenied:
		return http.StatusForbidden
	case codes.Unauthenticated:
		return http.StatusUnauthorized
	case codes.ResourceExhausted:
		return http.StatusTooManyRequests
	case codes.FailedPrecondition:
		return http.StatusPreconditionFailed
	case codes.Aborted:
		return http.StatusConflict
	case codes.OutOfRange:
		return http.StatusBadRequest
	case codes.Unimplemented:
		return http.StatusNotImplemented
	case codes.Internal:
		return http.StatusInternalServerError
	case codes.Unavailable:
		return http.StatusServiceUnavailable
	case codes.DataLoss:
		return http.StatusInternalServerError
	case codes.DeadlineExceeded:
		return http.StatusGatewayTimeout
	default:
		return http.StatusInternalServerError
	}
}

// writeJSONResponse writes a protobuf message as JSON response
func writeJSONResponse(w http.ResponseWriter, msg interface{}, err error) {
	w.Header().Set("Content-Type", "application/json")

	if err != nil {
		status := httpStatusFromGRPC(err)
		w.WriteHeader(status)
		errorResp := map[string]string{"error": err.Error()}
		// Also log error to stdout for debugging visibility
		log.Printf("[ERROR] %v", err)
		json.NewEncoder(w).Encode(errorResp)
		return
	}

	if msg == nil {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Use protojson for consistent serialization with EmitDefaultValues to include dayIndex: 0
	marshalOpts := protojson.MarshalOptions{
		EmitDefaultValues: true,
		UseProtoNames:     false, // Use camelCase field names for JSON
	}
	b, marshalErr := marshalOpts.Marshal(msg.(proto.Message))
	if marshalErr != nil {
		w.WriteHeader(http.StatusInternalServerError)
		errorResp := map[string]string{"error": "Failed to marshal response"}
		json.NewEncoder(w).Encode(errorResp)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(b)
}

func main() {
	// Initialize logging client
	ctx := context.Background()
	loggingServiceAddr := os.Getenv("LOGGING_SERVICE_ADDR")
	if loggingServiceAddr == "" {
		loggingServiceAddr = "localhost:50052"
	}

	var err error
	grpcLogger, err = logger.NewLoggingClient(loggingServiceAddr, "api-gateway")
	if err != nil {
		log.Printf("gRPC logging service not available at %s: %v, falling back to console", loggingServiceAddr, err)
	}

	// Connect to backend gRPC server
	backendAddr := os.Getenv("BACKEND_GRPC_ADDR")
	if backendAddr == "" {
		backendAddr = "localhost:50051"
	}

	conn, err := grpc.NewClient(backendAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		if grpcLogger != nil {
			grpcLogger.LogWithDetails(ctx, "FATAL", "Failed to connect to backend gRPC server: "+err.Error(), "", "api-gateway", nil)
		}
		log.Fatal("Failed to connect to backend gRPC server:", err)
	}
	defer conn.Close()

	mealPlannerClient = apipb.NewMealPlannerAPIClient(conn)

	// Connect to agent gRPC service
	agentAddr := os.Getenv("AGENT_GRPC_ADDR")
	if agentAddr == "" {
		agentAddr = "localhost:50053"
	}
	agentConn, err := grpc.NewClient(agentAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal("Failed to connect to agent gRPC server:", err)
	}
	defer agentConn.Close()

	agentClient := agentpb.NewAgentServiceClient(agentConn)
	gw := NewGateway(mealPlannerClient, agentClient)

	// Set up HTTP routes with Chi router
	r := chi.NewRouter()

	// Add middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

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

	// Swagger UI
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("http://localhost:8090/swagger/doc.json"),
	))

	// Health endpoints
	r.Get("/api/health", gw.healthCheck)

	// Meal plan endpoints
	r.Get("/api/mealplan", gw.getMealPlan)
	r.Post("/api/mealplan/generate", gw.generateMealPlan)
	r.Post("/api/mealplan/finalize", gw.finalizeMealPlan)

	// Shopping list endpoints
	r.Post("/api/shoppinglist", gw.getShoppingList)

	// Meals endpoints
	r.Get("/api/meals", gw.getAllMeals)
	r.Post("/api/meals", gw.createMeal)
	r.Put("/api/meals/{mealId}", gw.updateMeal)
	r.Post("/api/meals/swap", gw.swapMeal)
	r.Post("/api/meals/{mealId}/ingredients", gw.createMealIngredient)
	r.Put("/api/meals/{mealId}/ingredients/{ingredientId}", gw.updateMealIngredient)
	r.Delete("/api/meals/{mealId}/ingredients/{ingredientId}", gw.deleteMealIngredient)
	r.Delete("/api/meals/{mealId}", gw.deleteMeal)
	r.Post("/api/mealplan/replace", gw.replaceMeal)

	// Recipe steps endpoints
	r.Get("/api/meals/{mealId}/steps", gw.getSteps)
	r.Post("/api/meals/{mealId}/steps", gw.addStep)
	r.Post("/api/meals/{mealId}/steps/bulk", gw.addBulkSteps)
	r.Put("/api/meals/{mealId}/steps/{stepId}", gw.updateStep)
	r.Delete("/api/meals/{mealId}/steps/{stepId}", gw.deleteStep)
	r.Put("/api/meals/{mealId}/steps/reorder", gw.reorderSteps)
	r.Delete("/api/meals/{mealId}/steps", gw.deleteAllSteps)

	// Agent workflow endpoints
	r.Route("/api/agent", func(r chi.Router) {
		r.Post("/start", gw.startAgentWorkflow)
		r.Post("/message", gw.messageAgent)
		r.Get("/status/{threadId}", gw.getWorkflowStatus)
		r.Get("/workflows", gw.listWorkflows)
		r.Delete("/workflows/{threadId}", gw.cancelWorkflow)
	})

	// Workflow management endpoints
	r.Get("/api/workflows/{threadId}", gw.getWorkflowState)
	r.Post("/api/workflows/{threadId}/abandon", gw.abandonWorkflow)
	r.Get("/api/workflows/{threadId}/messages", gw.getMessages)
	r.Post("/api/workflows/{threadId}/messages", gw.addMessage)

	// Checkpoint persistence endpoints
	r.Get("/api/checkpoints/{thread_id}", gw.getCheckpoint)
	r.Post("/api/checkpoints", gw.putCheckpoint)
	r.Get("/api/checkpoints", gw.listCheckpoints)

	if grpcLogger != nil {
		grpcLogger.LogWithDetails(ctx, "INFO", "API Gateway starting on :8090, connecting to backend gRPC :50051", "", "api-gateway", nil)
	}
	log.Println("API Gateway starting on :8090, connecting to backend gRPC :50051")
	log.Fatal(http.ListenAndServe(":8090", r))
}

// Health endpoints

// @Summary Health Check
// @Description Check the health status of the API gateway and all backend services
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} apipb.HealthCheckResponse "Health check successful"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /health [get]
func (gw *Gateway) healthCheck(w http.ResponseWriter, r *http.Request) {
	log.Printf("🔍 Starting quick health check...")
	services := make(map[string]bool)

	// Check logging service (single attempt)
	log.Printf("🔍 Checking logging service...")
	loggingHealthy := false
	if grpcLogger != nil {
		if err := grpcLogger.LogWithDetails(r.Context(), "DEBUG", "Health check test message", "", "api-gateway", nil); err != nil {
			log.Printf("❌ Logging service health check failed: %v", err)
		} else {
			loggingHealthy = true
			log.Printf("✅ Logging service health check passed")
		}
	} else {
		log.Printf("❌ Logging service client not initialized")
	}
	services["logging"] = loggingHealthy

	// Check backend service (single attempt)
	log.Printf("🔍 Checking backend service...")
	backendHealthy := false
	backendResp, backendErr := gw.backend.HealthCheck(r.Context(), &emptypb.Empty{})
	if backendErr != nil {
		log.Printf("❌ Backend health check failed: %v", backendErr)
	} else if backendResp == nil {
		log.Printf("❌ Backend health check returned nil response")
	} else {
		backendHealthy = true
		log.Printf("✅ Backend health check passed")
	}
	services["backend"] = backendHealthy

	// Check agent service (single attempt)
	log.Printf("🔍 Checking agent service...")
	agentHealthy := false
	agentResp, agentErr := gw.agent.HealthCheck(r.Context(), &emptypb.Empty{})
	if agentErr != nil {
		log.Printf("❌ Agent health check failed: %v", agentErr)
	} else if agentResp == nil {
		log.Printf("❌ Agent health check returned nil response")
	} else {
		agentHealthy = true
		log.Printf("✅ Agent health check passed")
	}
	services["agent"] = agentHealthy

	// Check MCP service (single attempt)
	log.Printf("🔍 Checking MCP service...")
	mcpHealthy := false
	mcpAddr := os.Getenv("MCP_SERVICE_ADDR")
	if mcpAddr == "" {
		mcpAddr = "localhost:3001"
	}

	// Use a short timeout for the HTTP request
	client := &http.Client{
		Timeout: 2 * time.Second,
	}

	if mcpResp, err := client.Get("http://" + mcpAddr + "/health"); err != nil {
		log.Printf("❌ MCP health check failed: %v", err)
	} else {
		defer mcpResp.Body.Close()
		if mcpResp.StatusCode == 200 {
			mcpHealthy = true
			log.Printf("✅ MCP health check passed (status: %d)", mcpResp.StatusCode)
		} else {
			log.Printf("❌ MCP health check failed (status: %d)", mcpResp.StatusCode)
		}
	}
	services["mcp"] = mcpHealthy

	// Determine overall health
	allHealthy := services["logging"] && services["backend"] && services["agent"] && services["mcp"]

	log.Printf("📊 Health check summary:")
	log.Printf("  - Logging: %v", services["logging"])
	log.Printf("  - Backend: %v", services["backend"])
	log.Printf("  - Agent: %v", services["agent"])
	log.Printf("  - MCP: %v", services["mcp"])
	log.Printf("  - Overall: %v", allHealthy)

	response := &apipb.HealthCheckResponse{
		Status:   "ok",
		Message:  "All services healthy",
		Services: services,
	}

	if !allHealthy {
		response.Status = "degraded"
		response.Message = "Some services are unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
		log.Printf("⚠️ Returning degraded health status")
		writeJSONResponse(w, response, nil)
	} else {
		log.Printf("✅ Returning healthy status")
		writeJSONResponse(w, response, nil)
	}
}

// Meal plan endpoints

// @Summary Get Meal Plan
// @Description Get the current meal plan
// @Tags mealplan
// @Accept json
// @Produce json
// @Success 200 {object} apipb.GetMealPlanResponse "Meal plan retrieved successfully"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /mealplan [get]
func (gw *Gateway) getMealPlan(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.backend.GetMealPlan(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

// @Summary Generate Meal Plan
// @Description Generate a new meal plan
// @Tags mealplan
// @Accept json
// @Produce json
// @Success 200 {object} apipb.GenerateMealPlanResponse "Meal plan generated successfully"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /mealplan/generate [post]
func (gw *Gateway) generateMealPlan(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.backend.GenerateMealPlan(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

// @Summary Finalize Meal Plan
// @Description Finalize the current meal plan
// @Tags mealplan
// @Accept json
// @Produce json
// @Param request body apipb.FinalizeMealPlanRequest true "Finalize meal plan request"
// @Success 200 {object} apipb.FinalizeMealPlanResponse "Meal plan finalized successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /mealplan/finalize [post]
func (gw *Gateway) finalizeMealPlan(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("🔧 [GATEWAY-FINALIZE] Raw request body: %s", string(body))
	log.Printf("🔧 [GATEWAY-FINALIZE] Content-Type: %s", r.Header.Get("Content-Type"))

	var req apipb.FinalizeMealPlanRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		log.Printf("🔧 [GATEWAY-FINALIZE] Protobuf unmarshal error: %v", err)
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("🔧 [GATEWAY-FINALIZE] Parsed request - Thread ID: %s", req.ThreadId)

	log.Printf("🔧 [GATEWAY-FINALIZE] Calling backend FinalizeMealPlan...")
	resp, err := gw.backend.FinalizeMealPlan(r.Context(), &req)
	if err != nil {
		log.Printf("🔧 [GATEWAY-FINALIZE] Backend error: %v", err)
	} else {
		log.Printf("🔧 [GATEWAY-FINALIZE] Backend success: %s", resp.Message)
	}
	writeJSONResponse(w, resp, err)
}

// Shopping list endpoints

// @Summary Get Shopping List
// @Description Get shopping list for meal plan
// @Tags shopping
// @Accept json
// @Produce json
// @Param request body apipb.GetShoppingListRequest true "Shopping list request"
// @Success 200 {object} apipb.GetShoppingListResponse "Shopping list retrieved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /shoppinglist [post]
func (gw *Gateway) getShoppingList(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req apipb.GetShoppingListRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.backend.GetShoppingList(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// Meals endpoints

// @Summary Get All Meals
// @Description Get all available meals
// @Tags meals
// @Accept json
// @Produce json
// @Param type query string false "Meal type filter"
// @Success 200 {object} apipb.GetAllMealsResponse "Meals retrieved successfully"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals [get]
func (gw *Gateway) getAllMeals(w http.ResponseWriter, r *http.Request) {
	req := &apipb.GetAllMealsRequest{
		Type: r.URL.Query().Get("type"),
	}

	resp, err := gw.backend.GetAllMeals(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Create Meal
// @Description Create a new meal
// @Tags meals
// @Accept json
// @Produce json
// @Param request body apipb.CreateMealRequest true "Create meal request"
// @Success 201 {object} apipb.CreateMealResponse "Meal created successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals [post]
func (gw *Gateway) createMeal(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req apipb.CreateMealRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.backend.CreateMeal(r.Context(), &req)
	if err == nil {
		w.WriteHeader(http.StatusCreated)
	}
	writeJSONResponse(w, resp, err)
}

// @Summary Update Meal
// @Description Update an existing meal's properties (name, effort, meal type, etc.)
// @Tags meals
// @Accept json
// @Produce json
// @Param mealId path int true "Meal ID"
// @Param request body apipb.UpdateMealRequest true "Update meal request"
// @Success 200 {object} apipb.UpdateMealResponse "Meal updated successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 404 {object} ErrorResponse "Meal not found"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId} [put]
func (gw *Gateway) updateMeal(w http.ResponseWriter, r *http.Request) {
	mealIDStr := chi.URLParam(r, "mealId")
	mealID, err := strconv.Atoi(mealIDStr)
	if err != nil {
		http.Error(w, "Invalid meal ID: "+err.Error(), http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var updateReq apipb.UpdateMealRequest
	if err := protojson.Unmarshal(body, &updateReq); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Ensure the meal ID from URL matches the request
	updateReq.MealId = int32(mealID)

	req := &apipb.UpdateMealRequest{
		MealId: updateReq.MealId,
		Meal:   updateReq.Meal,
	}

	resp, err := gw.backend.UpdateMeal(r.Context(), req)
	if err != nil {
		if err.Error() == "meal not found" {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
	}
	writeJSONResponse(w, resp, err)
}

// @Summary Swap Meal
// @Description Swap a meal with another
// @Tags meals
// @Accept json
// @Produce json
// @Param request body apipb.SwapMealRequest true "Swap meal request"
// @Success 200 {object} apipb.SwapMealResponse "Meal swapped successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/swap [post]
func (gw *Gateway) swapMeal(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req apipb.SwapMealRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.backend.SwapMeal(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// @Summary Create Meal Ingredient
// @Description Add a new ingredient to a meal
// @Tags meals
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Param request body apipb.CreateMealIngredientRequest true "Create ingredient request"
// @Success 200 {object} apipb.CreateMealIngredientResponse "Ingredient created successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/ingredients [post]
func (gw *Gateway) createMealIngredient(w http.ResponseWriter, r *http.Request) {
	mealId, err := strconv.Atoi(chi.URLParam(r, "mealId"))
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var createReq apipb.CreateMealIngredientRequest
	if err := protojson.Unmarshal(body, &createReq); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Override the meal ID from URL path parameter to ensure consistency
	req := &apipb.CreateMealIngredientRequest{
		MealId:     int32(mealId),
		Ingredient: createReq.Ingredient,
	}

	resp, err := gw.backend.CreateMealIngredient(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Update Meal Ingredient
// @Description Update an ingredient in a meal
// @Tags meals
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Param ingredientId path string true "Ingredient ID"
// @Param request body apipb.UpdateMealIngredientRequest true "Update ingredient request"
// @Success 200 {object} apipb.UpdateMealIngredientResponse "Ingredient updated successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/ingredients/{ingredientId} [put]
func (gw *Gateway) updateMealIngredient(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")
	ingredientIdStr := chi.URLParam(r, "ingredientId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	ingredientId, err := strconv.ParseInt(ingredientIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid ingredient ID", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var updateReq apipb.UpdateMealIngredientRequest
	if err := protojson.Unmarshal(body, &updateReq); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Override the IDs from URL path parameters to ensure consistency
	req := &apipb.UpdateMealIngredientRequest{
		MealId:       int32(mealId),
		IngredientId: int32(ingredientId),
		Ingredient:   updateReq.Ingredient,
	}

	resp, err := gw.backend.UpdateMealIngredient(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Delete Meal Ingredient
// @Description Delete an ingredient from a meal
// @Tags meals
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Param ingredientId path string true "Ingredient ID"
// @Success 200 {object} apipb.DeleteMealIngredientResponse "Ingredient deleted successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/ingredients/{ingredientId} [delete]
func (gw *Gateway) deleteMealIngredient(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")
	ingredientIdStr := chi.URLParam(r, "ingredientId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	ingredientId, err := strconv.ParseInt(ingredientIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid ingredient ID", http.StatusBadRequest)
		return
	}

	req := &apipb.DeleteMealIngredientRequest{
		MealId:       int32(mealId),
		IngredientId: int32(ingredientId),
	}

	resp, err := gw.backend.DeleteMealIngredient(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Delete Meal
// @Description Delete a meal
// @Tags meals
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Success 200 {object} apipb.DeleteMealResponse "Meal deleted successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId} [delete]
func (gw *Gateway) deleteMeal(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	req := &apipb.DeleteMealRequest{
		MealId: int32(mealId),
	}

	resp, err := gw.backend.DeleteMeal(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Replace Meal
// @Description Replace a meal in the plan
// @Tags meals
// @Accept json
// @Produce json
// @Param request body apipb.ReplaceMealRequest true "Replace meal request"
// @Success 200 {object} apipb.ReplaceMealResponse "Meal replaced successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /mealplan/replace [post]
func (gw *Gateway) replaceMeal(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req apipb.ReplaceMealRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.backend.ReplaceMeal(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// Recipe steps endpoints
// @Summary Get Recipe Steps
// @Description Get recipe steps for a meal
// @Tags steps
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Success 200 {object} apipb.GetStepsResponse "Steps retrieved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/steps [get]
func (gw *Gateway) getSteps(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	req := &apipb.GetStepsRequest{
		MealId: int32(mealId),
	}

	resp, err := gw.backend.GetSteps(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Add Recipe Step
// @Description Add a recipe step to a meal
// @Tags steps
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Param request body apipb.AddStepRequest true "Add step request"
// @Success 200 {object} apipb.AddStepResponse "Step added successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/steps [post]
func (gw *Gateway) addStep(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var step apipb.Step
	if err := protojson.Unmarshal(body, &step); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	req := &apipb.AddStepRequest{
		MealId: int32(mealId),
		Step:   &step,
	}

	resp, err := gw.backend.AddStep(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Add Bulk Recipe Steps
// @Description Add multiple recipe steps to a meal
// @Tags steps
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Param request body apipb.AddBulkStepsRequest true "Add bulk steps request"
// @Success 200 {object} apipb.AddBulkStepsResponse "Steps added successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/steps/bulk [post]
func (gw *Gateway) addBulkSteps(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var reqBody struct {
		Instructions []string `json:"instructions"`
	}
	if err := json.Unmarshal(body, &reqBody); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	req := &apipb.AddBulkStepsRequest{
		MealId:       int32(mealId),
		Instructions: reqBody.Instructions,
	}

	resp, err := gw.backend.AddBulkSteps(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Update Recipe Step
// @Description Update a recipe step in a meal
// @Tags steps
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Param stepId path string true "Step ID"
// @Param request body apipb.UpdateStepRequest true "Update step request"
// @Success 200 {object} apipb.UpdateStepResponse "Step updated successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/steps/{stepId} [put]
func (gw *Gateway) updateStep(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")
	stepIdStr := chi.URLParam(r, "stepId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	stepId, err := strconv.ParseInt(stepIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid step ID", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var step apipb.Step
	if err := protojson.Unmarshal(body, &step); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	req := &apipb.UpdateStepRequest{
		MealId: int32(mealId),
		StepId: int32(stepId),
		Step:   &step,
	}

	resp, err := gw.backend.UpdateStep(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Delete Recipe Step
// @Description Delete a recipe step from a meal
// @Tags steps
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Param stepId path string true "Step ID"
// @Success 200 {object} apipb.DeleteStepResponse "Step deleted successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/steps/{stepId} [delete]
func (gw *Gateway) deleteStep(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")
	stepIdStr := chi.URLParam(r, "stepId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	stepId, err := strconv.ParseInt(stepIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid step ID", http.StatusBadRequest)
		return
	}

	req := &apipb.DeleteStepRequest{
		MealId: int32(mealId),
		StepId: int32(stepId),
	}

	resp, err := gw.backend.DeleteStep(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Reorder Recipe Steps
// @Description Reorder recipe steps in a meal
// @Tags steps
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Param request body apipb.ReorderStepsRequest true "Reorder steps request"
// @Success 200 {object} apipb.ReorderStepsResponse "Steps reordered successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/steps/reorder [put]
func (gw *Gateway) reorderSteps(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var reqBody struct {
		StepIds []int32 `json:"step_ids"`
	}
	if err := json.Unmarshal(body, &reqBody); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	req := &apipb.ReorderStepsRequest{
		MealId:  int32(mealId),
		StepIds: reqBody.StepIds,
	}

	resp, err := gw.backend.ReorderSteps(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Delete All Recipe Steps
// @Description Delete all recipe steps from a meal
// @Tags steps
// @Accept json
// @Produce json
// @Param mealId path string true "Meal ID"
// @Success 200 {object} apipb.DeleteAllStepsResponse "All steps deleted successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/{mealId}/steps [delete]
func (gw *Gateway) deleteAllSteps(w http.ResponseWriter, r *http.Request) {
	mealIdStr := chi.URLParam(r, "mealId")

	mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	req := &apipb.DeleteAllStepsRequest{
		MealId: int32(mealId),
	}

	resp, err := gw.backend.DeleteAllSteps(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// Agent workflow endpoints

// @Summary Start Agent Workflow
// @Description Start a new agent workflow for meal planning
// @Tags agent
// @Accept json
// @Produce json
// @Param request body apipb.StartAgentWorkflowRequest true "Agent start request"
// @Success 200 {object} apipb.StartAgentWorkflowResponse "Agent workflow started successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /agent/start [post]
func (gw *Gateway) startAgentWorkflow(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Try to unmarshal as direct AgentStartRequest first (for backward compatibility)
	var agentReq apipb.AgentStartRequest
	if err := protojson.Unmarshal(body, &agentReq); err == nil {
		// Direct format - wrap it
		req := &apipb.StartAgentWorkflowRequest{
			Request: &agentReq,
		}
		resp, err := gw.agent.StartAgentWorkflow(r.Context(), req)
		writeJSONResponse(w, resp, err)
		return
	}

	// Try wrapped format
	var req apipb.StartAgentWorkflowRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.agent.StartAgentWorkflow(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// @Summary Message Agent
// @Description Send a message to an existing agent workflow
// @Tags agent
// @Accept json
// @Produce json
// @Param request body apipb.MessageAgentRequest true "Agent message request"
// @Success 200 {object} apipb.MessageAgentResponse "Message sent successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /agent/message [post]
func (gw *Gateway) messageAgent(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Try to unmarshal as direct AgentMessageRequest first (for backward compatibility)
	var agentReq apipb.AgentMessageRequest
	if err := protojson.Unmarshal(body, &agentReq); err == nil {
		// Direct format - wrap it
		req := &apipb.MessageAgentRequest{
			Request: &agentReq,
		}
		resp, err := gw.agent.MessageAgent(r.Context(), req)
		writeJSONResponse(w, resp, err)
		return
	}

	// Try wrapped format
	var req apipb.MessageAgentRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.agent.MessageAgent(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// @Summary Get Workflow Status
// @Description Get the status of an agent workflow
// @Tags agent
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} apipb.GetWorkflowStatusResponse "Workflow status retrieved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /agent/status/{threadId} [get]
func (gw *Gateway) getWorkflowStatus(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	req := &apipb.GetWorkflowStatusRequest{
		ThreadId: threadId,
	}

	resp, err := gw.agent.GetWorkflowStatus(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary List Workflows
// @Description List all active workflows
// @Tags agent
// @Accept json
// @Produce json
// @Success 200 {object} apipb.ListWorkflowsResponse "Workflows listed successfully"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /agent/workflows [get]
func (gw *Gateway) listWorkflows(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.agent.ListWorkflows(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

// @Summary Cancel Workflow
// @Description Cancel an active workflow
// @Tags agent
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} apipb.CancelWorkflowResponse "Workflow cancelled successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /agent/workflows/{threadId} [delete]
func (gw *Gateway) cancelWorkflow(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	req := &apipb.CancelWorkflowRequest{
		ThreadId: threadId,
	}

	resp, err := gw.agent.CancelWorkflow(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// Workflow management endpoints
// @Summary Get Workflow State
// @Description Get the current state of a workflow
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} apipb.GetWorkflowStateResponse "Workflow state retrieved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /workflows/{threadId} [get]
func (gw *Gateway) getWorkflowState(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	req := &apipb.GetWorkflowStateRequest{
		ThreadId: threadId,
	}

	resp, err := gw.agent.GetWorkflowState(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Abandon Workflow
// @Description Abandon a workflow
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} apipb.AbandonWorkflowResponse "Workflow abandoned successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /workflows/{threadId}/abandon [post]
func (gw *Gateway) abandonWorkflow(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	req := &apipb.AbandonWorkflowRequest{
		ThreadId: threadId,
	}

	resp, err := gw.agent.AbandonWorkflow(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Add Message
// @Description Add a message to a workflow
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Param request body apipb.AddMessageRequest true "Add message request"
// @Success 200 {object} apipb.AddMessageResponse "Message added successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /workflows/{threadId}/messages [post]
func (gw *Gateway) addMessage(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var reqBody struct {
		Sender  string `json:"sender"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &reqBody); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	req := &apipb.AddMessageRequest{
		ThreadId: threadId,
		Sender:   reqBody.Sender,
		Message:  reqBody.Message,
	}

	resp, err := gw.agent.AddMessage(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Get Messages
// @Description Get all messages for a workflow thread
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} apipb.GetMessagesResponse "Messages retrieved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /workflows/{threadId}/messages [get]
func (gw *Gateway) getMessages(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")
	if threadId == "" {
		http.Error(w, "threadId is required", http.StatusBadRequest)
		return
	}

	req := &apipb.GetMessagesRequest{
		ThreadId: threadId,
	}

	resp, err := gw.agent.GetMessages(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// Checkpoint persistence endpoints

// @Summary Get Checkpoint
// @Description Get a checkpoint by thread ID
// @Tags checkpoint
// @Accept json
// @Produce json
// @Param thread_id path string true "Thread ID"
// @Param checkpoint_ns query string false "Checkpoint namespace"
// @Success 200 {object} apipb.GetCheckpointResponse "Checkpoint retrieved successfully"
// @Failure 404 {object} ErrorResponse "Checkpoint not found"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /checkpoints/{thread_id} [get]
func (gw *Gateway) getCheckpoint(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "thread_id")
	checkpointNs := r.URL.Query().Get("checkpoint_ns")

	req := &apipb.GetCheckpointRequest{
		ThreadId:     threadId,
		CheckpointNs: checkpointNs,
	}

	resp, err := gw.agent.GetCheckpoint(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Put Checkpoint
// @Description Save a checkpoint
// @Tags checkpoint
// @Accept json
// @Produce json
// @Param request body apipb.PutCheckpointRequest true "Put checkpoint request"
// @Success 200 {object} apipb.PutCheckpointResponse "Checkpoint saved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /checkpoints [post]
func (gw *Gateway) putCheckpoint(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req apipb.PutCheckpointRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.agent.PutCheckpoint(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// @Summary List Checkpoints
// @Description List all checkpoints
// @Tags checkpoint
// @Accept json
// @Produce json
// @Param limit query int false "Limit number of results"
// @Param before_thread_id query string false "Before thread ID for pagination"
// @Success 200 {object} apipb.ListCheckpointsResponse "Checkpoints listed successfully"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /checkpoints [get]
func (gw *Gateway) listCheckpoints(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	beforeThreadId := r.URL.Query().Get("before_thread_id")

	var limit int32
	if limitStr != "" {
		if l, err := strconv.ParseInt(limitStr, 10, 32); err == nil {
			limit = int32(l)
		}
	}

	req := &apipb.ListCheckpointsRequest{
		Limit:          limit,
		BeforeThreadId: beforeThreadId,
	}

	resp, err := gw.agent.ListCheckpoints(r.Context(), req)
	writeJSONResponse(w, resp, err)
}
