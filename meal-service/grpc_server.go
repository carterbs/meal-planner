package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/repositories"
	"mealplanner/server"

	"go.uber.org/zap"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func getGrpcServerLogger() *zap.SugaredLogger {
	return logging.GetGrpcLogger("grpc-server")
}

type MealPlannerAPIServer struct {
	apipb.UnimplementedMealPlannerAPIServer
}

func calculateWeekStart(ref time.Time) time.Time {
	weekday := int(ref.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	daysUntilMonday := weekday - 1
	weekStart := ref.AddDate(0, 0, -daysUntilMonday)
	return time.Date(weekStart.Year(), weekStart.Month(), weekStart.Day(), 0, 0, 0, 0, weekStart.Location())
}

func calculateWeekBounds(ref time.Time) (time.Time, time.Time) {
    weekStart := calculateWeekStart(ref)
    return weekStart, weekStart.AddDate(0, 0, 6)
}

func buildShoppingList(mealIDs []int) ([]*apipb.ShoppingListItem, error) {
    return server.Services.ShoppingListService.BuildShoppingList(mealIDs)
}

// getOrCreateCurrentWeekMealPlan gets or creates a meal plan for the current week
func getOrCreateCurrentWeekMealPlan(ctx context.Context) (*apipb.MealPlan, error) {
	logger := getGrpcServerLogger()

	weekStart, weekEnd := calculateWeekBounds(time.Now())

	// Try to get existing meal plan for this week
	existingPlan, err := server.Services.MealPlanRepository.GetMealPlanByWeek(ctx, weekStart)
	if err != nil {
		logger.Errorw("Error fetching meal plan by week", "error", err, "weekStart", weekStart)
		return nil, fmt.Errorf("error fetching meal plan by week: %w", err)
	}

	if existingPlan != nil {
		logger.Debugw("Found existing meal plan", "id", existingPlan.Id, "status", existingPlan.Status)
		return existingPlan, nil
	}

	// No existing plan, generate a new one
	logger.Debugw("No existing plan found, generating new one", "weekStart", weekStart)
	items, err := server.Services.MealPlanRepository.GenerateMealPlanItems(ctx)
	if err != nil {
		return nil, fmt.Errorf("error generating meal plan items: %w", err)
	}

	planID, err := server.Services.MealPlanRepository.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
	if err != nil {
		logger.Errorw("Error persisting new meal plan", "error", err)
		return nil, fmt.Errorf("error persisting meal plan: %w", err)
	}

	for _, item := range items {
		item.MealPlanId = int32(planID)
	}

	if err := server.Services.MealPlanRepository.UpsertMealPlanItems(ctx, planID, items); err != nil {
		logger.Errorw("Error upserting meal plan items", "error", err, "planID", planID)
		return nil, fmt.Errorf("error upserting meal plan items: %w", err)
	}

	newPlan, err := server.Services.MealPlanRepository.GetMealPlanByID(ctx, planID)
	if err != nil {
		logger.Errorw("Error fetching newly created meal plan", "error", err, "planID", planID)
		return nil, fmt.Errorf("error fetching meal plan: %w", err)
	}

	logger.Infow("Created and persisted new meal plan", "id", planID, "weekStart", weekStart)
	return newPlan, nil
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

func (s *MealPlannerAPIServer) GetMealPlan(ctx context.Context, req *emptypb.Empty) (*apipb.GetMealPlanResponse, error) {
	logger := getGrpcServerLogger()

	// Try to get or create the current week's meal plan using the new storage
	mealPlan, err := getOrCreateCurrentWeekMealPlan(ctx)
	if err != nil {
		logger.Errorw("Error getting/creating current week meal plan", "error", err)
		return nil, fmt.Errorf("error getting meal plan: %w", err)
	}

	logger.Debugw("GetMealPlan: returning plan", "planID", mealPlan.Id, "itemCount", len(mealPlan.Items))
	return &apipb.GetMealPlanResponse{Plan: mealPlan}, nil
}

func (s *MealPlannerAPIServer) GenerateMealPlan(ctx context.Context, req *emptypb.Empty) (*apipb.GenerateMealPlanResponse, error) {
	logger := getGrpcServerLogger()

	items, err := server.Services.MealPlanRepository.GenerateMealPlanItems(ctx)
	if err != nil {
		logger.Errorw("Error generating meal plan items", "error", err)
		return nil, fmt.Errorf("error generating meal plan: %w", err)
	}

	weekStart, weekEnd := calculateWeekBounds(time.Now())

	existingPlan, err := server.Services.MealPlanRepository.GetMealPlanByWeek(ctx, weekStart)
	if err != nil {
		logger.Errorw("Error checking for existing meal plan", "error", err)
		return nil, fmt.Errorf("error checking existing plan: %w", err)
	}

	var planID int
	if existingPlan != nil {
		planID = int(existingPlan.Id)
		logger.Infow("Regenerating existing meal plan", "planID", planID, "currentVersion", existingPlan.GetVersion())

		if err := server.Services.MealPlanRepository.UpdateMealPlanStatus(ctx, planID, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT); err != nil {
			logger.Errorw("Error updating meal plan status", "error", err, "planID", planID)
			return nil, fmt.Errorf("error updating meal plan status: %w", err)
		}

		newVersion := int(existingPlan.GetVersion()) + 1
		if err := server.Services.MealPlanRepository.UpdateMealPlanVersion(ctx, planID, newVersion); err != nil {
			logger.Errorw("Error updating meal plan version", "error", err, "planID", planID, "version", newVersion)
			return nil, fmt.Errorf("error updating meal plan version: %w", err)
		}
	} else {
		planID, err = server.Services.MealPlanRepository.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_DRAFT, nil)
		if err != nil {
			logger.Errorw("Error persisting new meal plan", "error", err)
			return nil, fmt.Errorf("error persisting meal plan: %w", err)
		}
		logger.Infow("Created new meal plan", "planID", planID)
	}

	for _, item := range items {
		item.MealPlanId = int32(planID)
	}

	if err := server.Services.MealPlanRepository.UpsertMealPlanItems(ctx, planID, items); err != nil {
		logger.Errorw("Error upserting meal plan items", "error", err, "planID", planID)
		return nil, fmt.Errorf("error upserting meal plan items: %w", err)
	}

	plan, err := server.Services.MealPlanRepository.GetMealPlanByID(ctx, planID)
	if err != nil {
		logger.Errorw("Error fetching regenerated meal plan", "error", err, "planID", planID)
		return nil, fmt.Errorf("error fetching meal plan: %w", err)
	}

	logger.Infow("GenerateMealPlan: returning new plan", "planID", planID, "itemCount", len(plan.Items))
	return &apipb.GenerateMealPlanResponse{
		Plan: plan,
	}, nil
}

func (s *MealPlannerAPIServer) FinalizeMealPlan(ctx context.Context, req *apipb.FinalizeMealPlanRequest) (*apipb.FinalizeMealPlanResponse, error) {
	logger := getGrpcServerLogger()
	logger.Info("FinalizeMealPlan called")

	if req.ThreadId == "" {
		logger.Error("No thread ID provided in request")
		return nil, fmt.Errorf("thread ID is required")
	}

	logger.Infow("Processing finalize request", "threadID", req.ThreadId)

	// Get checkpoint and extract meal plan
	checkpoint, err := getCheckpointFromDB(req.ThreadId)
	if err != nil {
		logger.Errorw("Failed to get checkpoint", "threadID", req.ThreadId, "error", err)
		return nil, fmt.Errorf("failed to get checkpoint: %w", err)
	}

	if checkpoint.State.MealPlan == nil {
		logger.Error("No meal plan found in checkpoint")
		return nil, fmt.Errorf("no meal plan found in checkpoint")
	}

	mealPlan := checkpoint.State.MealPlan
	logger.Infow("Processing meal plan from checkpoint", "itemCount", len(mealPlan.Items))

	mealIDSet := make(map[int]struct{})
	for i, item := range mealPlan.Items {
		if item == nil {
			continue
		}

		var mealID int32
		switch {
		case item.MealId != nil:
			mealID = *item.MealId
		case item.MealSnapshot != nil:
			mealID = item.MealSnapshot.Id
		}

		if mealID != 0 {
			mealIDSet[int(mealID)] = struct{}{}
			logger.Debugw("Found meal in plan", "index", i, "mealID", mealID, "dayIndex", item.DayIndex, "mealType", models.MealSlotToString(item.MealType))
		}
	}

	mealIDs := make([]int, 0, len(mealIDSet))
	for id := range mealIDSet {
		mealIDs = append(mealIDs, id)
	}

	logger.Infow("Unique meals to finalize", "mealIDs", mealIDs, "count", len(mealIDs))

	weekStart, weekEnd := calculateWeekBounds(time.Now())

	mealPlan.WeekStartDate = timestamppb.New(weekStart)
	mealPlan.WeekEndDate = timestamppb.New(weekEnd)
	mealPlan.Status = apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED
	mealPlan.UpdatedAt = timestamppb.Now()
	if req.ThreadId != "" {
		mealPlan.ThreadId = &req.ThreadId
	}

	// Check if a meal plan already exists for this week
	existingPlan, err := server.Services.MealPlanRepository.GetMealPlanByWeek(ctx, weekStart)
	if err != nil {
		logger.Errorw("Error checking for existing meal plan", "error", err)
		return nil, fmt.Errorf("error checking existing plan: %w", err)
	}

	var planID int
	if existingPlan != nil {
		// Update existing plan
		planID = int(existingPlan.Id)
		mealPlan.Id = existingPlan.Id
		mealPlan.Version = existingPlan.Version

		logger.Infow("Finalizing existing meal plan", "planID", planID, "version", mealPlan.Version)

		// Update status to finalized
		err = server.Services.MealPlanRepository.UpdateMealPlanStatus(ctx, planID, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED)
		if err != nil {
			logger.Errorw("Error updating meal plan status", "error", err, "planID", planID)
			return nil, fmt.Errorf("error updating meal plan status: %w", err)
		}
	} else {
		// Create new finalized plan
		planID, err = server.Services.MealPlanRepository.InsertMealPlan(ctx, weekStart, weekEnd, apipb.MealPlanStatus_MEAL_PLAN_STATUS_FINALIZED, &req.ThreadId)
		if err != nil {
			logger.Errorw("Error creating meal plan", "error", err)
			return nil, fmt.Errorf("error creating meal plan: %w", err)
		}

		mealPlan.Id = int32(planID)
		logger.Infow("Created new finalized meal plan", "planID", planID)
	}

	for _, item := range mealPlan.Items {
		if item != nil {
			item.MealPlanId = int32(planID)
		}
	}

	if err := server.Services.MealPlanRepository.UpsertMealPlanItems(ctx, planID, mealPlan.Items); err != nil {
		logger.Errorw("Error upserting meal plan items", "error", err, "planID", planID)
		return nil, fmt.Errorf("error upserting meal plan items: %w", err)
	}

	// Persist last_planned timestamps for meals
	if len(mealIDs) > 0 {
		logger.Infow("Updating last_planned dates for meals", "mealCount", len(mealIDs))
		if err := server.Services.MealService.UpdateLastPlannedDates(mealIDs); err != nil {
			logger.Errorw("UpdateLastPlannedDates failed", "error", err)
			return nil, fmt.Errorf("failed to update last planned dates: %w", err)
		}
		logger.Info("UpdateLastPlannedDates succeeded")
	} else {
		logger.Warn("No meal IDs to update")
	}

	logger.Infow("FinalizeMealPlan completed successfully", "planID", planID, "threadID", req.ThreadId)
	return &apipb.FinalizeMealPlanResponse{
		Message: fmt.Sprintf("Meal plan %d finalized successfully", planID),
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

	ingredientRepo := repositories.NewIngredientRepository(server.DB)
	err := ingredientRepo.CreateMealIngredient(ctx, int(req.MealId), req.Ingredient)
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

	ingredientRepo := repositories.NewIngredientRepository(server.DB)
	err := ingredientRepo.UpdateMealIngredient(ctx, int(req.MealId), req.Ingredient)
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
	ingredientRepo := repositories.NewIngredientRepository(server.DB)
	err := ingredientRepo.DeleteMealIngredient(ctx, int(req.IngredientId))
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
	steps, err := server.Services.RecipeStepRepository.GetStepsForMeal(context.Background(), int(req.MealId))
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

	// The repository expects a protobuf Step
	req.Step.MealId = req.MealId
	createdStep, err := server.Services.RecipeStepRepository.AddStepToMeal(context.Background(), req.Step)
	if err != nil {
		return nil, fmt.Errorf("error adding step: %w", err)
	}

	return &apipb.AddStepResponse{
		Step: createdStep,
	}, nil
}

func (s *MealPlannerAPIServer) AddBulkSteps(ctx context.Context, req *apipb.AddBulkStepsRequest) (*apipb.AddBulkStepsResponse, error) {
	steps, err := server.Services.RecipeStepRepository.AddMultipleStepsToMeal(context.Background(), int(req.MealId), req.Instructions)
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

	err := server.Services.RecipeStepRepository.UpdateStep(context.Background(), req.Step)
	if err != nil {
		return nil, fmt.Errorf("error updating step: %w", err)
	}

	return &apipb.UpdateStepResponse{
		Step: req.Step,
	}, nil
}

func (s *MealPlannerAPIServer) DeleteStep(ctx context.Context, req *apipb.DeleteStepRequest) (*apipb.DeleteStepResponse, error) {
	err := server.Services.RecipeStepRepository.DeleteStep(context.Background(), int(req.StepId), int(req.MealId))
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

	err := server.Services.RecipeStepRepository.ReorderSteps(context.Background(), int(req.MealId), stepIds)
	if err != nil {
		return nil, fmt.Errorf("error reordering steps: %w", err)
	}

	return &apipb.ReorderStepsResponse{
		Message: "Steps reordered successfully",
	}, nil
}

func (s *MealPlannerAPIServer) DeleteAllSteps(ctx context.Context, req *apipb.DeleteAllStepsRequest) (*apipb.DeleteAllStepsResponse, error) {
	err := server.Services.RecipeStepRepository.DeleteAllStepsForMeal(context.Background(), int(req.MealId))
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
	var keys []string
	for k := range stateData {
		keys = append(keys, k)
	}
	getGrpcServerLogger().Info(fmt.Sprintf("🔧 [BACKEND-FINALIZE] Checkpoint state keys: %v", keys))
	mealPlanData, ok := stateData["mealPlan"].(map[string]interface{})
	if !ok {
		getGrpcServerLogger().Error(fmt.Sprintf("🔧 [BACKEND-FINALIZE] mealPlan key not found or wrong type. Available keys: %v", keys))
		return nil, fmt.Errorf("meal plan is missing or invalid in checkpoint state")
	}

	// Convert meal plan data to protobuf MealPlan
	mealPlan, err := convertToMealPlan(mealPlanData)
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

// convertToMealPlan converts raw JSON meal plan data to protobuf MealPlan.
func convertToMealPlan(mealPlanData map[string]interface{}) (*apipb.MealPlan, error) {
	bytes, err := json.Marshal(mealPlanData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal meal plan data: %w", err)
	}

	var plan apipb.MealPlan
	unmarshaler := protojson.UnmarshalOptions{
		DiscardUnknown: true,
	}
	if err := unmarshaler.Unmarshal(bytes, &plan); err != nil {
		return nil, fmt.Errorf("failed to unmarshal meal plan: %w", err)
	}

	return &plan, nil
}
