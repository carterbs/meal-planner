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
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	logger "logging-service/client/go"
	apipb "mealplanner/generated/go"
)

var grpcLogger *logger.LoggingClient
var mealPlannerClient apipb.MealPlannerAPIClient

// Gateway represents the API Gateway server
type Gateway struct {
	client apipb.MealPlannerAPIClient
}

// NewGateway creates a new Gateway instance
func NewGateway(client apipb.MealPlannerAPIClient) *Gateway {
	return &Gateway{client: client}
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
	gw := NewGateway(mealPlannerClient)
	
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
func (gw *Gateway) healthCheck(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.client.HealthCheck(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

func (gw *Gateway) reconnect(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.client.Reconnect(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

// Meal plan endpoints
func (gw *Gateway) getMealPlan(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.client.GetMealPlan(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

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

func (gw *Gateway) generateMealPlan(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.client.GenerateMealPlan(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.FinalizeMealPlan(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

func (gw *Gateway) getMealPlanICS(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.client.GetMealPlanICS(r.Context(), &emptypb.Empty{})
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
	
	resp, err := gw.client.GetShoppingList(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// Meals endpoints
func (gw *Gateway) getAllMeals(w http.ResponseWriter, r *http.Request) {
	req := &apipb.GetAllMealsRequest{
		Type: r.URL.Query().Get("type"),
	}
	
	resp, err := gw.client.GetAllMeals(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.CreateMeal(r.Context(), &req)
	if err == nil {
		w.WriteHeader(http.StatusCreated)
	}
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.SwapMeal(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.RemoveMeal(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.UpdateMealIngredient(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.DeleteMealIngredient(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.DeleteMeal(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.ReplaceMeal(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

// Recipe steps endpoints
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
	
	resp, err := gw.client.GetSteps(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.AddStep(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.AddBulkSteps(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.UpdateStep(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.DeleteStep(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.ReorderSteps(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.DeleteAllSteps(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// Agent workflow endpoints
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
		resp, err := gw.client.StartAgentWorkflow(r.Context(), req)
		writeJSONResponse(w, resp, err)
		return
	}
	
	// Try wrapped format
	var req apipb.StartAgentWorkflowRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}
	
	resp, err := gw.client.StartAgentWorkflow(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

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
		resp, err := gw.client.MessageAgent(r.Context(), req)
		writeJSONResponse(w, resp, err)
		return
	}
	
	// Try wrapped format
	var req apipb.MessageAgentRequest
	if err := protojson.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}
	
	resp, err := gw.client.MessageAgent(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

func (gw *Gateway) getWorkflowStatus(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")
	
	req := &apipb.GetWorkflowStatusRequest{
		ThreadId: threadId,
	}
	
	resp, err := gw.client.GetWorkflowStatus(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

func (gw *Gateway) listWorkflows(w http.ResponseWriter, r *http.Request) {
	resp, err := gw.client.ListWorkflows(r.Context(), &emptypb.Empty{})
	writeJSONResponse(w, resp, err)
}

func (gw *Gateway) cancelWorkflow(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")
	
	req := &apipb.CancelWorkflowRequest{
		ThreadId: threadId,
	}
	
	resp, err := gw.client.CancelWorkflow(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// Workflow management endpoints
func (gw *Gateway) getWorkflowState(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")
	
	req := &apipb.GetWorkflowStateRequest{
		ThreadId: threadId,
	}
	
	resp, err := gw.client.GetWorkflowState(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

func (gw *Gateway) abandonWorkflow(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")
	
	req := &apipb.AbandonWorkflowRequest{
		ThreadId: threadId,
	}
	
	resp, err := gw.client.AbandonWorkflow(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.AddMessage(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.UpdateSessionState(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

// Checkpoint persistence endpoints
func (gw *Gateway) getCheckpoint(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "thread_id")
	checkpointNs := r.URL.Query().Get("checkpoint_ns")
	
	req := &apipb.GetCheckpointRequest{
		ThreadId:     threadId,
		CheckpointNs: checkpointNs,
	}
	
	resp, err := gw.client.GetCheckpoint(r.Context(), req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.PutCheckpoint(r.Context(), &req)
	writeJSONResponse(w, resp, err)
}

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
	
	resp, err := gw.client.ListCheckpoints(r.Context(), req)
	writeJSONResponse(w, resp, err)
}