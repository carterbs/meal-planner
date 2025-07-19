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
// @host localhost:8080
// @BasePath /api

// Response structures for Swagger documentation
type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// Ingredient represents a meal ingredient
type IngredientResponse struct {
	Id       int32   `json:"id"`
	MealId   int32   `json:"mealId"`
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit"`
	Name     string  `json:"name"`
}

// Step represents a cooking step
type StepResponse struct {
	Id          int32  `json:"id"`
	MealId      int32  `json:"mealId"`
	StepNumber  int32  `json:"stepNumber"`
	Instruction string `json:"instruction"`
}

// ShoppingListItem represents a shopping list item
type ShoppingListItemResponse struct {
	Ingredient string `json:"ingredient"`
	Quantity   string `json:"quantity"`
	Category   string `json:"category"`
}

// MealPlanEntry represents a meal plan entry
type MealPlanEntryResponse struct {
	Meal     *MealResponse `json:"meal,omitempty"`
	DayIndex int32         `json:"dayIndex"`
	MealType string        `json:"mealType"`
}

// AgentStartRequest represents the request to start an agent workflow
type AgentStartRequestBody struct {
	Participants []string `json:"participants"`
	WorkflowType string   `json:"workflowType"`
}

// AgentMessageRequest represents the request to send a message to an agent
type AgentMessageRequestBody struct {
	ThreadId    string `json:"threadId"`
	Message     string `json:"message"`
	From        string `json:"from"`
	Interactive bool   `json:"interactive"`
}

// AgentResponse represents the response from agent operations
type AgentResponseBody struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	ThreadId     string `json:"threadId"`
	CurrentStep  string `json:"currentStep"`
	InitialState string `json:"initialState,omitempty"`
}

type AgentStartResponse struct {
	Response AgentResponseBody `json:"response"`
}

type AgentMessageResponse struct {
	Response AgentResponseBody `json:"response"`
}

// MessageResponse represents a single message
type MessageResponse struct {
	ThreadId  string `json:"threadId"`
	Sender    string `json:"sender"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

// GetMessagesResponse represents the response from getting messages
type GetMessagesResponse struct {
	Messages []MessageResponse `json:"messages"`
}

type CheckpointResponse struct {
	Tuple struct {
		Checkpoint struct {
			State struct {
				ThreadId string `json:"threadId"`
				MealPlan struct {
					Days []MealPlanEntryResponse `json:"days"`
				} `json:"mealPlan"`
				Participants []string `json:"participants"`
				CurrentStep  string   `json:"currentStep"`
			} `json:"state"`
		} `json:"checkpoint"`
	} `json:"tuple"`
	Found bool `json:"found"`
}

type MealPlanResponse struct {
	Plan struct {
		Days         []MealPlanEntryResponse    `json:"days"`
		ShoppingList []ShoppingListItemResponse `json:"shoppingList"`
	} `json:"plan"`
}

type MealResponse struct {
	Id          int32                `json:"id"`
	Name        string               `json:"name"`
	Effort      int32                `json:"effort"`
	HasRedMeat  bool                 `json:"hasRedMeat"`
	Url         string               `json:"url"`
	MealType    string               `json:"mealType"`
	Ingredients []IngredientResponse `json:"ingredients"`
	Steps       []StepResponse       `json:"steps"`
}

type MealsResponse struct {
	Meals []MealResponse `json:"meals"`
}

type ShoppingListResponse struct {
	Items []ShoppingListItemResponse `json:"items"`
}

type SimpleMessageResponse struct {
	Message string `json:"message"`
}

type StepsResponse struct {
	Steps []StepResponse `json:"steps"`
}

type WorkflowStatusResponse struct {
	Status struct {
		ThreadId     string   `json:"threadId"`
		WorkflowType string   `json:"workflowType"`
		CurrentStep  string   `json:"currentStep"`
		Participants []string `json:"participants"`
	} `json:"status"`
}

type WorkflowsResponse struct {
	Workflows []WorkflowStatusResponse `json:"workflows"`
}

type WorkflowMessageResponse struct {
	ThreadId  string `json:"threadId"`
	Sender    string `json:"sender"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

type WorkflowStateResponse struct {
	Plan struct {
		Days []MealPlanEntryResponse `json:"days"`
	} `json:"plan"`
	ShoppingList struct {
		Items []ShoppingListItemResponse `json:"items"`
	} `json:"shoppingList"`
	Messages []WorkflowMessageResponse `json:"messages"`
}

type CheckpointTupleResponse struct {
	Checkpoint struct {
		State struct {
			ThreadId string `json:"threadId"`
			MealPlan struct {
				Days []MealPlanEntryResponse `json:"days"`
			} `json:"mealPlan"`
			Participants []string `json:"participants"`
			CurrentStep  string   `json:"currentStep"`
		} `json:"state"`
	} `json:"checkpoint"`
}

type CheckpointListResponse struct {
	Entries []struct {
		ThreadId     string                  `json:"threadId"`
		CheckpointNs string                  `json:"checkpointNs"`
		Tuple        CheckpointTupleResponse `json:"tuple"`
	} `json:"entries"`
}

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

	// Use protojson for consistent serialization
	b, marshalErr := protojson.Marshal(msg.(proto.Message))
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
		httpSwagger.URL("http://localhost:8080/swagger/doc.json"),
	))

	// Health endpoints
	r.Get("/api/health", gw.healthCheck)
	r.Post("/api/reconnect", gw.reconnect)

	// Meal plan endpoints
	r.Get("/api/mealplan", gw.getMealPlan)
	r.Post("/api/mealplan", gw.saveMealPlan)
	r.Post("/api/mealplan/generate", gw.generateMealPlan)
	r.Post("/api/mealplan/finalize", gw.finalizeMealPlan)
	r.Get("/api/mealplan/ics", gw.getMealPlanICS)

	// Shopping list endpoints
	r.Post("/api/shoppinglist", gw.getShoppingList)

	// Meals endpoints
	r.Get("/api/meals", gw.getAllMeals)
	r.Post("/api/meals", gw.createMeal)
	r.Post("/api/meals/swap", gw.swapMeal)
	r.Post("/api/meals/remove", gw.removeMeal)
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
	r.Put("/api/workflows/{threadId}/state", gw.updateSessionState)

	// Checkpoint persistence endpoints
	r.Get("/api/checkpoints/{thread_id}", gw.getCheckpoint)
	r.Post("/api/checkpoints", gw.putCheckpoint)
	r.Get("/api/checkpoints", gw.listCheckpoints)

	if grpcLogger != nil {
		grpcLogger.LogWithDetails(ctx, "INFO", "API Gateway starting on :8080, connecting to backend gRPC :50051", "", "api-gateway", nil)
	}
	log.Println("API Gateway starting on :8080, connecting to backend gRPC :50051")
	log.Fatal(http.ListenAndServe(":8080", r))
}

// Health endpoints

// @Summary Health Check
// @Description Check the health status of the API gateway and backend services
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} HealthResponse "Health check successful"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /health [get]
func (gw *Gateway) healthCheck(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.backend.HealthCheck(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

// @Summary Reconnect
// @Description Reconnect to backend services
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} HealthResponse "Reconnect successful"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /reconnect [post]
func (gw *Gateway) reconnect(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.backend.Reconnect(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

// Meal plan endpoints

// @Summary Get Meal Plan
// @Description Get the current meal plan
// @Tags mealplan
// @Accept json
// @Produce json
// @Success 200 {object} MealPlanResponse "Meal plan retrieved successfully"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /mealplan [get]
func (gw *Gateway) getMealPlan(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.backend.GetMealPlan(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

// @Summary Save Meal Plan
// @Description Save the current meal plan
// @Tags mealplan
// @Accept json
// @Produce json
// @Param request body apipb.SaveMealPlanRequest true "Save meal plan request"
// @Success 200 {object} SimpleMessageResponse "Meal plan saved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 501 {object} ErrorResponse "Not implemented"
// @Router /mealplan [post]
func (gw *Gateway) saveMealPlan(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req apipb.SaveMealPlanRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Note: SaveMealPlan is not in the gRPC service definition, so we'll need to handle this differently
	// For now, return an error indicating this endpoint needs implementation
	http.Error(w, "SaveMealPlan not yet implemented in gRPC service", http.StatusNotImplemented)
}

// @Summary Generate Meal Plan
// @Description Generate a new meal plan
// @Tags mealplan
// @Accept json
// @Produce json
// @Success 200 {object} MealPlanResponse "Meal plan generated successfully"
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
// @Success 200 {object} SimpleMessageResponse "Meal plan finalized successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /mealplan/finalize [post]
func (gw *Gateway) finalizeMealPlan(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req apipb.FinalizeMealPlanRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.backend.FinalizeMealPlan(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// @Summary Get Meal Plan ICS
// @Description Get meal plan as ICS calendar file
// @Tags mealplan
// @Accept json
// @Produce text/calendar
// @Success 200 {file} binary "ICS calendar file"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /mealplan/ics [get]
func (gw *Gateway) getMealPlanICS(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.backend.GetMealPlanICS(r.Context(), &emptypb.Empty{})
	if err != nil {
		status := httpStatusFromGRPC(err)
		http.Error(w, err.Error(), status)
		return
	}

	w.Header().Set("Content-Type", "text/calendar")
	w.Header().Set("Content-Disposition", "attachment; filename=mealplan.ics")
	w.Write(resp.IcsData)
}

// Shopping list endpoints

// @Summary Get Shopping List
// @Description Get shopping list for meal plan
// @Tags shopping
// @Accept json
// @Produce json
// @Param request body apipb.GetShoppingListRequest true "Shopping list request"
// @Success 200 {object} ShoppingListResponse "Shopping list retrieved successfully"
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
// @Success 200 {object} MealsResponse "Meals retrieved successfully"
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
// @Success 201 {object} MealResponse "Meal created successfully"
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

// @Summary Swap Meal
// @Description Swap a meal with another
// @Tags meals
// @Accept json
// @Produce json
// @Param request body apipb.SwapMealRequest true "Swap meal request"
// @Success 200 {object} MealResponse "Meal swapped successfully"
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

// @Summary Remove Meal
// @Description Remove a meal from the plan
// @Tags meals
// @Accept json
// @Produce json
// @Param request body apipb.RemoveMealRequest true "Remove meal request"
// @Success 200 {object} MealPlanResponse "Meal removed successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /meals/remove [post]
func (gw *Gateway) removeMeal(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req apipb.RemoveMealRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := gw.backend.RemoveMeal(r.Context(), &req)
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
// @Success 200 {object} MealResponse "Ingredient updated successfully"
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

	var ingredient apipb.Ingredient
	if err := protojson.Unmarshal(body, &ingredient); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	req := &apipb.UpdateMealIngredientRequest{
		MealId:       int32(mealId),
		IngredientId: int32(ingredientId),
		Ingredient:   &ingredient,
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
// @Success 200 {object} MealResponse "Ingredient deleted successfully"
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
// @Success 200 {object} SimpleMessageResponse "Meal deleted successfully"
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
// @Success 200 {object} MealResponse "Meal replaced successfully"
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
// @Success 200 {object} StepsResponse "Steps retrieved successfully"
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
// @Success 200 {object} StepResponse "Step added successfully"
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
// @Success 200 {object} StepsResponse "Steps added successfully"
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
// @Success 200 {object} StepResponse "Step updated successfully"
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
// @Success 200 {object} SimpleMessageResponse "Step deleted successfully"
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
// @Success 200 {object} SimpleMessageResponse "Steps reordered successfully"
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
// @Success 200 {object} SimpleMessageResponse "All steps deleted successfully"
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
// @Param request body AgentStartRequestBody true "Agent start request"
// @Success 200 {object} AgentStartResponse "Agent workflow started successfully"
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
// @Param request body AgentMessageRequestBody true "Agent message request"
// @Success 200 {object} AgentMessageResponse "Message sent successfully"
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
// @Success 200 {object} WorkflowStatusResponse "Workflow status retrieved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /agent/status/{threadId} [get]
func (gw *Gateway) getWorkflowStatus(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	req := &apipb.GetWorkflowStatusRequest{
		ThreadId: threadId,
	}

	resp, err := gw.backend.GetWorkflowStatus(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary List Workflows
// @Description List all active workflows
// @Tags agent
// @Accept json
// @Produce json
// @Success 200 {object} WorkflowsResponse "Workflows listed successfully"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /agent/workflows [get]
func (gw *Gateway) listWorkflows(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.backend.ListWorkflows(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

// @Summary Cancel Workflow
// @Description Cancel an active workflow
// @Tags agent
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} SimpleMessageResponse "Workflow cancelled successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /agent/workflows/{threadId} [delete]
func (gw *Gateway) cancelWorkflow(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	req := &apipb.CancelWorkflowRequest{
		ThreadId: threadId,
	}

	resp, err := gw.backend.CancelWorkflow(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// Workflow management endpoints
// @Summary Get Workflow State
// @Description Get the current state of a workflow
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} WorkflowStateResponse "Workflow state retrieved successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /workflows/{threadId} [get]
func (gw *Gateway) getWorkflowState(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	req := &apipb.GetWorkflowStateRequest{
		ThreadId: threadId,
	}

	resp, err := gw.backend.GetWorkflowState(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Abandon Workflow
// @Description Abandon a workflow
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} SimpleMessageResponse "Workflow abandoned successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /workflows/{threadId}/abandon [post]
func (gw *Gateway) abandonWorkflow(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	req := &apipb.AbandonWorkflowRequest{
		ThreadId: threadId,
	}

	resp, err := gw.backend.AbandonWorkflow(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Add Message
// @Description Add a message to a workflow
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Param request body apipb.AddMessageRequest true "Add message request"
// @Success 200 {object} SimpleMessageResponse "Message added successfully"
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

	resp, err := gw.backend.AddMessage(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Get Messages
// @Description Get all messages for a workflow thread
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Success 200 {object} GetMessagesResponse "Messages retrieved successfully"
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

	resp, err := gw.backend.GetMessages(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Update Session State
// @Description Update the state of a workflow session
// @Tags workflow
// @Accept json
// @Produce json
// @Param threadId path string true "Thread ID"
// @Param request body apipb.UpdateSessionStateRequest true "Update session state request"
// @Success 200 {object} SimpleMessageResponse "Session state updated successfully"
// @Failure 400 {object} ErrorResponse "Bad request"
// @Failure 500 {object} ErrorResponse "Internal server error"
// @Router /workflows/{threadId}/state [put]
func (gw *Gateway) updateSessionState(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var reqBody struct {
		MealPlan     string `json:"meal_plan"`
		ShoppingList string `json:"shopping_list"`
		CurrentStep  string `json:"current_step"`
		Status       string `json:"status"`
	}
	if err := json.Unmarshal(body, &reqBody); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	req := &apipb.UpdateSessionStateRequest{
		ThreadId:     threadId,
		MealPlan:     reqBody.MealPlan,
		ShoppingList: reqBody.ShoppingList,
		CurrentStep:  reqBody.CurrentStep,
		Status:       reqBody.Status,
	}

	resp, err := gw.backend.UpdateSessionState(r.Context(), req)
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
// @Success 200 {object} CheckpointResponse "Checkpoint retrieved successfully"
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

	resp, err := gw.backend.GetCheckpoint(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// @Summary Put Checkpoint
// @Description Save a checkpoint
// @Tags checkpoint
// @Accept json
// @Produce json
// @Param request body apipb.PutCheckpointRequest true "Put checkpoint request"
// @Success 200 {object} SimpleMessageResponse "Checkpoint saved successfully"
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

	resp, err := gw.backend.PutCheckpoint(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// @Summary List Checkpoints
// @Description List all checkpoints
// @Tags checkpoint
// @Accept json
// @Produce json
// @Param limit query int false "Limit number of results"
// @Param before_thread_id query string false "Before thread ID for pagination"
// @Success 200 {object} CheckpointListResponse "Checkpoints listed successfully"
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

	resp, err := gw.backend.ListCheckpoints(r.Context(), req)
	writeJSONResponse(w, resp, err)
}
