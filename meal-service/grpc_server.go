package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"
	"mealplanner/server"

	"google.golang.org/protobuf/types/known/emptypb"
)

var grpcServerLogger = logging.GetGrpcLogger("grpc-server")

type MealPlannerAPIServer struct {
	apipb.UnimplementedMealPlannerAPIServer
}

func generateShoppingListForPlan(plan *apipb.WeeklyMealPlan) error {
	mealIDs := make([]int, 0)
	for _, d := range plan.Days {
		if d.Meal != nil {
			mealIDs = append(mealIDs, int(d.Meal.GetId()))
		}
	}
	if len(mealIDs) == 0 {
		plan.ShoppingList = nil
		return nil
	}

	items, err := buildShoppingList(mealIDs)
	if err != nil {
		return err
	}
	plan.ShoppingList = items
	return nil
}

func buildShoppingList(mealIDs []int) ([]*apipb.ShoppingListItem, error) {
	return server.Services.ShoppingListService.BuildShoppingList(mealIDs)
}

func (s *MealPlannerAPIServer) HealthCheck(ctx context.Context, req *emptypb.Empty) (*apipb.HealthCheckResponse, error) {
	var healthIssues []string
	dbHealthy := false
	loggingHealthy := false

	// Check database health (single attempt)
	if server.DB == nil {
		healthIssues = append(healthIssues, "Database not connected")
	} else if err := server.DB.Ping(); err != nil {
		healthIssues = append(healthIssues, fmt.Sprintf("Database connection failed: %v", err))
	} else {
		dbHealthy = true
	}

	// Check logging service health (single attempt)
	grpcClient := logging.GetGrpcClient()
	if grpcClient == nil {
		healthIssues = append(healthIssues, "Logging client not initialized")
	} else {
		// Try to log a test message to verify logging service connectivity
		err := grpcClient.LogWithDetails(ctx, "DEBUG", "Health check test message", "", "meal-service", nil)
		if err != nil {
			healthIssues = append(healthIssues, fmt.Sprintf("Logging service connection failed: %v", err))
		} else {
			loggingHealthy = true
		}
	}

	// Determine overall health
	if dbHealthy && loggingHealthy {
		return &apipb.HealthCheckResponse{
			Status:  "ok",
			Message: "All dependencies healthy",
		}, nil
	}

	if len(healthIssues) > 0 {
		return &apipb.HealthCheckResponse{
			Status:  "error",
			Message: fmt.Sprintf("Health check failed: %v", healthIssues),
		}, nil
	}

	return &apipb.HealthCheckResponse{
		Status:  "error",
		Message: "Unknown health check error",
	}, nil
}

func (s *MealPlannerAPIServer) Reconnect(ctx context.Context, req *emptypb.Empty) (*apipb.ReconnectResponse, error) {
	// Check database connection
	if server.DB == nil {
		return &apipb.ReconnectResponse{
			Status:  "error",
			Message: "Database not connected. Make sure Docker is running and the database container is started.",
		}, nil
	}

	if err := server.DB.Ping(); err == nil {
		return &apipb.ReconnectResponse{
			Status:  "ok",
			Message: "Database connection is already established and healthy",
		}, nil
	}

	// For now, just return error as actual reconnection logic is complex
	return &apipb.ReconnectResponse{
		Status:  "error",
		Message: "Database reconnection not implemented in gRPC server. Use HTTP endpoint for reconnection.",
	}, nil
}

func (s *MealPlannerAPIServer) GetMealPlan(ctx context.Context, req *emptypb.Empty) (*apipb.GetMealPlanResponse, error) {
	var plan *apipb.WeeklyMealPlan
	var err error

	plan, err = server.Services.MealPlanService.GetLastPlannedMeals()
	if err != nil {
		plan, err = server.Services.MealPlanService.GenerateWeeklyMealPlan()
		if err != nil {
			return nil, fmt.Errorf("error generating meal plan: %w", err)
		}
	}

	detailedPlan, err := server.Services.MealPlanService.PopulateMealDetails(plan)
	if err != nil {
		return nil, fmt.Errorf("error fetching meal details: %w", err)
	}

	if err := generateShoppingListForPlan(detailedPlan); err != nil {
		return nil, fmt.Errorf("error generating shopping list: %w", err)
	}

	return &apipb.GetMealPlanResponse{Plan: detailedPlan}, nil
}

func (s *MealPlannerAPIServer) GenerateMealPlan(ctx context.Context, req *emptypb.Empty) (*apipb.GenerateMealPlanResponse, error) {
	plan, err := server.Services.MealPlanService.GenerateWeeklyMealPlan()
	if err != nil {
		return nil, fmt.Errorf("error generating meal plan: %w", err)
	}

	detailedPlan, err := server.Services.MealPlanService.PopulateMealDetails(plan)
	if err != nil {
		return nil, fmt.Errorf("error fetching meal details: %w", err)
	}

	if err := generateShoppingListForPlan(detailedPlan); err != nil {
		return nil, fmt.Errorf("error generating shopping list: %w", err)
	}

	return &apipb.GenerateMealPlanResponse{
		Plan: detailedPlan,
	}, nil
}

func (s *MealPlannerAPIServer) FinalizeMealPlan(ctx context.Context, req *apipb.FinalizeMealPlanRequest) (*apipb.FinalizeMealPlanResponse, error) {
	grpcServerLogger.Info("🔧 [BACKEND-FINALIZE] FinalizeMealPlan called")

	if req.ThreadId == "" {
		grpcServerLogger.Error("🔧 [BACKEND-FINALIZE] No thread ID provided in request")
		return nil, fmt.Errorf("thread ID is required")
	}

	grpcServerLogger.Info(fmt.Sprintf("🔧 [BACKEND-FINALIZE] Processing thread: %s", req.ThreadId))

	// Get checkpoint and extract meal plan
	checkpoint, err := getCheckpointFromDB(req.ThreadId)
	if err != nil {
		grpcServerLogger.Error(fmt.Sprintf("🔧 [BACKEND-FINALIZE] Failed to get checkpoint: %v", err))
		return nil, fmt.Errorf("failed to get checkpoint: %w", err)
	}

	if checkpoint.State.MealPlan == nil {
		grpcServerLogger.Error("🔧 [BACKEND-FINALIZE] No meal plan found in checkpoint")
		return nil, fmt.Errorf("no meal plan found in checkpoint")
	}

	grpcServerLogger.Info(fmt.Sprintf("🔧 [BACKEND-FINALIZE] Processing meal plan with %d days", len(checkpoint.State.MealPlan.Days)))

	// Collect meal IDs from the finalized plan
	mealIDSet := make(map[int]struct{})
	for i, entry := range checkpoint.State.MealPlan.Days {
		if entry != nil && entry.Meal != nil {
			mealID := int(entry.Meal.GetId())
			mealIDSet[mealID] = struct{}{}
			grpcServerLogger.Info(fmt.Sprintf("🔧 [BACKEND-FINALIZE] Day %d: Found meal ID %d", i, mealID))
		} else {
			grpcServerLogger.Info(fmt.Sprintf("🔧 [BACKEND-FINALIZE] Day %d: No meal found", i))
		}
	}
	var mealIDs []int
	for id := range mealIDSet {
		mealIDs = append(mealIDs, id)
	}

	grpcServerLogger.Info(fmt.Sprintf("🔧 [BACKEND-FINALIZE] Unique meal IDs to update: %v", mealIDs))

	// Persist last_planned timestamps
	if len(mealIDs) > 0 {
		grpcServerLogger.Info("🔧 [BACKEND-FINALIZE] Calling UpdateLastPlannedDates...")
		if err := server.Services.MealService.UpdateLastPlannedDates(mealIDs); err != nil {
			grpcServerLogger.Error(fmt.Sprintf("🔧 [BACKEND-FINALIZE] UpdateLastPlannedDates failed: %v", err))
			return nil, fmt.Errorf("failed to update last planned dates: %w", err)
		}
		grpcServerLogger.Info("🔧 [BACKEND-FINALIZE] UpdateLastPlannedDates succeeded")
	} else {
		grpcServerLogger.Warn("🔧 [BACKEND-FINALIZE] No meal IDs to update")
	}

	grpcServerLogger.Info("🔧 [BACKEND-FINALIZE] FinalizeMealPlan completed successfully")
	return &apipb.FinalizeMealPlanResponse{
		Message: "Meal plan finalized successfully",
	}, nil
}

func (s *MealPlannerAPIServer) GetMealPlanICS(ctx context.Context, req *emptypb.Empty) (*apipb.MealPlanICSResponse, error) {
	return &apipb.MealPlanICSResponse{
		IcsData: []byte(""),
	}, nil
}

func (s *MealPlannerAPIServer) GetShoppingList(ctx context.Context, req *apipb.GetShoppingListRequest) (*apipb.GetShoppingListResponse, error) {
	mealIDs := make([]int, len(req.Plan))
	for i, id := range req.Plan {
		mealIDs[i] = int(id)
	}

	items, err := buildShoppingList(mealIDs)
	if err != nil {
		return nil, fmt.Errorf("error building shopping list: %w", err)
	}

	return &apipb.GetShoppingListResponse{
		Items: items,
	}, nil
}

func (s *MealPlannerAPIServer) GetAllMeals(ctx context.Context, req *apipb.GetAllMealsRequest) (*apipb.GetAllMealsResponse, error) {
	meals, err := server.Services.MealService.GetAllMeals()
	if err != nil {
		return nil, fmt.Errorf("error retrieving meals: %w", err)
	}

	// Filter by meal type if specified
	if req.Type != "" {
		filteredMeals := []*apipb.Meal{}
		for _, meal := range meals {
			if meal.MealType == req.Type {
				filteredMeals = append(filteredMeals, meal)
			}
		}
		meals = filteredMeals
	}

	return &apipb.GetAllMealsResponse{
		Meals: meals,
	}, nil
}

func (s *MealPlannerAPIServer) CreateMeal(ctx context.Context, req *apipb.CreateMealRequest) (*apipb.CreateMealResponse, error) {
	if req.Meal == nil {
		return nil, fmt.Errorf("meal is required")
	}

	if req.Meal.Name == "" {
		return nil, fmt.Errorf("meal name is required")
	}

	meal, err := server.Services.MealService.CreateMeal(req.Meal)
	if err != nil {
		return nil, fmt.Errorf("error creating meal: %w", err)
	}

	return &apipb.CreateMealResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerAPIServer) UpdateMeal(ctx context.Context, req *apipb.UpdateMealRequest) (*apipb.UpdateMealResponse, error) {
	if req.Meal == nil {
		return nil, fmt.Errorf("meal is required")
	}

	if req.MealId == 0 {
		return nil, fmt.Errorf("meal ID is required")
	}

	if req.Meal.Name == "" {
		return nil, fmt.Errorf("meal name is required")
	}

	// Set the meal ID from the request to ensure consistency
	req.Meal.Id = req.MealId

	meal, err := server.Services.MealService.UpdateMeal(req.Meal)
	if err != nil {
		return nil, fmt.Errorf("error updating meal: %w", err)
	}

	return &apipb.UpdateMealResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerAPIServer) SwapMeal(ctx context.Context, req *apipb.SwapMealRequest) (*apipb.SwapMealResponse, error) {
	meal, err := server.Services.MealService.SwapMeal(int(req.MealId), req.MealType)
	if err != nil {
		return nil, fmt.Errorf("error swapping meal: %w", err)
	}

	return &apipb.SwapMealResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerAPIServer) ReplaceMeal(ctx context.Context, req *apipb.ReplaceMealRequest) (*apipb.ReplaceMealResponse, error) {
	// For now, return a simple success response as replace logic needs to be implemented
	return &apipb.ReplaceMealResponse{
		Meal: nil,
	}, nil
}

func (s *MealPlannerAPIServer) CreateMealIngredient(ctx context.Context, req *apipb.CreateMealIngredientRequest) (*apipb.CreateMealIngredientResponse, error) {
	if req.Ingredient == nil {
		return nil, fmt.Errorf("ingredient is required")
	}

	err := server.Services.IngredientService.CreateMealIngredient(int(req.MealId), req.Ingredient)
	if err != nil {
		return nil, fmt.Errorf("error creating meal ingredient: %w", err)
	}

	// Get updated meal to return
	meal, err := server.Services.MealService.GetMealByID(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error retrieving updated meal: %w", err)
	}

	return &apipb.CreateMealIngredientResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerAPIServer) UpdateMealIngredient(ctx context.Context, req *apipb.UpdateMealIngredientRequest) (*apipb.UpdateMealIngredientResponse, error) {
	if req.Ingredient == nil {
		return nil, fmt.Errorf("ingredient is required")
	}

	err := server.Services.IngredientService.UpdateMealIngredient(int(req.MealId), req.Ingredient)
	if err != nil {
		return nil, fmt.Errorf("error updating meal ingredient: %w", err)
	}

	// Get updated meal to return
	meal, err := server.Services.MealService.GetMealByID(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error retrieving updated meal: %w", err)
	}

	return &apipb.UpdateMealIngredientResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerAPIServer) DeleteMealIngredient(ctx context.Context, req *apipb.DeleteMealIngredientRequest) (*apipb.DeleteMealIngredientResponse, error) {
	err := server.Services.IngredientService.DeleteMealIngredient(int(req.IngredientId))
	if err != nil {
		return nil, fmt.Errorf("error deleting meal ingredient: %w", err)
	}

	// Get updated meal to return
	meal, err := server.Services.MealService.GetMealByID(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error retrieving updated meal: %w", err)
	}

	return &apipb.DeleteMealIngredientResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerAPIServer) DeleteMeal(ctx context.Context, req *apipb.DeleteMealRequest) (*apipb.DeleteMealResponse, error) {
	err := server.Services.MealService.DeleteMeal(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error deleting meal: %w", err)
	}

	return &apipb.DeleteMealResponse{
		Message: "Meal deleted successfully",
	}, nil
}

func (s *MealPlannerAPIServer) GetSteps(ctx context.Context, req *apipb.GetStepsRequest) (*apipb.GetStepsResponse, error) {
	steps, err := server.Services.RecipeStepService.GetStepsForMeal(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error getting steps: %w", err)
	}

	return &apipb.GetStepsResponse{
		Steps: steps,
	}, nil
}

func (s *MealPlannerAPIServer) AddStep(ctx context.Context, req *apipb.AddStepRequest) (*apipb.AddStepResponse, error) {
	if req.Step == nil {
		return nil, fmt.Errorf("step is required")
	}

	// The service expects a protobuf Step
	req.Step.MealId = req.MealId
	createdStep, err := server.Services.RecipeStepService.AddStepToMeal(req.Step)
	if err != nil {
		return nil, fmt.Errorf("error adding step: %w", err)
	}

	return &apipb.AddStepResponse{
		Step: createdStep,
	}, nil
}

func (s *MealPlannerAPIServer) AddBulkSteps(ctx context.Context, req *apipb.AddBulkStepsRequest) (*apipb.AddBulkStepsResponse, error) {
	steps, err := server.Services.RecipeStepService.AddMultipleStepsToMeal(int(req.MealId), req.Instructions)
	if err != nil {
		return nil, fmt.Errorf("error adding bulk steps: %w", err)
	}

	return &apipb.AddBulkStepsResponse{
		Steps: steps,
	}, nil
}

func (s *MealPlannerAPIServer) UpdateStep(ctx context.Context, req *apipb.UpdateStepRequest) (*apipb.UpdateStepResponse, error) {
	if req.Step == nil {
		return nil, fmt.Errorf("step is required")
	}

	// Ensure IDs are set correctly
	req.Step.Id = req.StepId
	req.Step.MealId = req.MealId

	err := server.Services.RecipeStepService.UpdateStep(req.Step)
	if err != nil {
		return nil, fmt.Errorf("error updating step: %w", err)
	}

	return &apipb.UpdateStepResponse{
		Step: req.Step,
	}, nil
}

func (s *MealPlannerAPIServer) DeleteStep(ctx context.Context, req *apipb.DeleteStepRequest) (*apipb.DeleteStepResponse, error) {
	err := server.Services.RecipeStepService.DeleteStep(int(req.StepId), int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error deleting step: %w", err)
	}

	return &apipb.DeleteStepResponse{
		Message: "Step deleted successfully",
	}, nil
}

func (s *MealPlannerAPIServer) ReorderSteps(ctx context.Context, req *apipb.ReorderStepsRequest) (*apipb.ReorderStepsResponse, error) {
	stepIds := make([]int, len(req.StepIds))
	for i, id := range req.StepIds {
		stepIds[i] = int(id)
	}

	err := server.Services.RecipeStepService.ReorderSteps(int(req.MealId), stepIds)
	if err != nil {
		return nil, fmt.Errorf("error reordering steps: %w", err)
	}

	return &apipb.ReorderStepsResponse{
		Message: "Steps reordered successfully",
	}, nil
}

func (s *MealPlannerAPIServer) DeleteAllSteps(ctx context.Context, req *apipb.DeleteAllStepsRequest) (*apipb.DeleteAllStepsResponse, error) {
	err := server.Services.RecipeStepService.DeleteAllStepsForMeal(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error deleting all steps: %w", err)
	}

	return &apipb.DeleteAllStepsResponse{
		Message: "All steps deleted successfully",
	}, nil
}

// getCheckpointFromDB retrieves and parses checkpoint data from the database
func getCheckpointFromDB(threadID string) (*apipb.AgentCheckpoint, error) {
	// Query the database for checkpoint data
	query := `SELECT checkpoint_data FROM workflow_checkpoints WHERE thread_id = $1 ORDER BY updated_at DESC LIMIT 1`

	var checkpointDataJSON []byte
	err := server.DB.QueryRow(query, threadID).Scan(&checkpointDataJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("checkpoint not found for thread ID: %s", threadID)
		}
		return nil, fmt.Errorf("failed to query checkpoint: %w", err)
	}

	// Parse the JSON data to extract the checkpoint structure
	var rawCheckpoint map[string]interface{}
	if err := json.Unmarshal(checkpointDataJSON, &rawCheckpoint); err != nil {
		return nil, fmt.Errorf("failed to parse checkpoint JSON: %w", err)
	}

	// Extract the state portion
	stateData, ok := rawCheckpoint["state"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("checkpoint state is missing or invalid")
	}

	// Extract meal plan from state
	mealPlanData, ok := stateData["meal_plan"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("meal plan is missing or invalid in checkpoint state")
	}

	// Convert meal plan data to protobuf WeeklyMealPlan
	mealPlan, err := convertToWeeklyMealPlan(mealPlanData)
	if err != nil {
		return nil, fmt.Errorf("failed to convert meal plan: %w", err)
	}

	// Create the checkpoint structure
	checkpoint := &apipb.AgentCheckpoint{
		State: &apipb.MealPlanningCheckpointState{
			MealPlan: mealPlan,
		},
	}

	return checkpoint, nil
}

// convertToWeeklyMealPlan converts raw JSON meal plan data to protobuf WeeklyMealPlan
func convertToWeeklyMealPlan(mealPlanData map[string]interface{}) (*apipb.WeeklyMealPlan, error) {
	daysData, ok := mealPlanData["days"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("meal plan days data is missing or invalid")
	}

	var days []*apipb.MealPlanEntry
	for _, dayData := range daysData {
		dayMap, ok := dayData.(map[string]interface{})
		if !ok {
			continue
		}

		entry := &apipb.MealPlanEntry{}

		// Extract meal data
		if mealData, ok := dayMap["meal"].(map[string]interface{}); ok {
			if mealID, ok := mealData["id"].(float64); ok {
				entry.Meal = &apipb.Meal{
					Id: int32(mealID),
				}
			}
		}

		// Extract day_index if available
		if dayIndex, ok := dayMap["day_index"].(float64); ok {
			entry.DayIndex = int32(dayIndex)
		}

		// Extract meal_type if available
		if mealType, ok := dayMap["meal_type"].(string); ok {
			entry.MealType = mealType
		}

		days = append(days, entry)
	}

	return &apipb.WeeklyMealPlan{
		Days: days,
	}, nil
}
