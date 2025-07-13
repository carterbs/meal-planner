package main

import (
	"context"
	"fmt"

	apipb "mealplanner/generated/go"
	"mealplanner/handlers"

	"google.golang.org/protobuf/types/known/emptypb"
)

type MealPlannerGRPCServer struct {
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
	return handlers.Services.ShoppingListService.BuildShoppingList(mealIDs)
}

func (s *MealPlannerGRPCServer) HealthCheck(ctx context.Context, req *emptypb.Empty) (*apipb.HealthCheckResponse, error) {
	if handlers.DB == nil {
		return &apipb.HealthCheckResponse{
			Status:  "error",
			Message: "Database not connected. Make sure Docker is running and the database container is started.",
		}, nil
	}

	if err := handlers.DB.Ping(); err != nil {
		return &apipb.HealthCheckResponse{
			Status:  "error",
			Message: "Database connection lost. Make sure Docker is running and the database container is started.",
		}, nil
	}

	return &apipb.HealthCheckResponse{
		Status:  "ok",
		Message: "Database connection is healthy",
	}, nil
}

func (s *MealPlannerGRPCServer) Reconnect(ctx context.Context, req *emptypb.Empty) (*apipb.ReconnectResponse, error) {
	return &apipb.ReconnectResponse{
		Status:  "error",
		Message: "Reconnect functionality not yet implemented in gRPC server",
	}, nil
}

func (s *MealPlannerGRPCServer) GetMealPlan(ctx context.Context, req *emptypb.Empty) (*apipb.GetMealPlanResponse, error) {
	var plan *apipb.WeeklyMealPlan
	var err error
	
	plan, err = handlers.Services.MealPlanService.GetLastPlannedMeals()
	if err != nil {
		plan, err = handlers.Services.MealPlanService.GenerateWeeklyMealPlan()
		if err != nil {
			return nil, fmt.Errorf("error generating meal plan: %w", err)
		}
	}

	detailedPlan, err := handlers.Services.MealPlanService.PopulateMealDetails(plan)
	if err != nil {
		return nil, fmt.Errorf("error fetching meal details: %w", err)
	}

	if err := generateShoppingListForPlan(detailedPlan); err != nil {
		return nil, fmt.Errorf("error generating shopping list: %w", err)
	}

	return &apipb.GetMealPlanResponse{Plan: detailedPlan}, nil
}

func (s *MealPlannerGRPCServer) GenerateMealPlan(ctx context.Context, req *emptypb.Empty) (*apipb.GenerateMealPlanResponse, error) {
	plan, err := handlers.Services.MealPlanService.GenerateWeeklyMealPlan()
	if err != nil {
		return nil, fmt.Errorf("error generating meal plan: %w", err)
	}

	detailedPlan, err := handlers.Services.MealPlanService.PopulateMealDetails(plan)
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

func (s *MealPlannerGRPCServer) FinalizeMealPlan(ctx context.Context, req *apipb.FinalizeMealPlanRequest) (*apipb.FinalizeMealPlanResponse, error) {
	return &apipb.FinalizeMealPlanResponse{
		Message: "FinalizeMealPlan not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) GetMealPlanICS(ctx context.Context, req *emptypb.Empty) (*apipb.MealPlanICSResponse, error) {
	return &apipb.MealPlanICSResponse{
		IcsData: []byte(""),
	}, nil
}

func (s *MealPlannerGRPCServer) GetShoppingList(ctx context.Context, req *apipb.GetShoppingListRequest) (*apipb.GetShoppingListResponse, error) {
	return &apipb.GetShoppingListResponse{
		Items: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) GetAllMeals(ctx context.Context, req *apipb.GetAllMealsRequest) (*apipb.GetAllMealsResponse, error) {
	return &apipb.GetAllMealsResponse{
		Meals: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) CreateMeal(ctx context.Context, req *apipb.CreateMealRequest) (*apipb.CreateMealResponse, error) {
	return &apipb.CreateMealResponse{
		Meal: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) SwapMeal(ctx context.Context, req *apipb.SwapMealRequest) (*apipb.SwapMealResponse, error) {
	return &apipb.SwapMealResponse{
		Meal: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) RemoveMeal(ctx context.Context, req *apipb.RemoveMealRequest) (*apipb.RemoveMealResponse, error) {
	return &apipb.RemoveMealResponse{
		Plan: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) ReplaceMeal(ctx context.Context, req *apipb.ReplaceMealRequest) (*apipb.ReplaceMealResponse, error) {
	return &apipb.ReplaceMealResponse{
		Meal: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) UpdateMealIngredient(ctx context.Context, req *apipb.UpdateMealIngredientRequest) (*apipb.UpdateMealIngredientResponse, error) {
	return &apipb.UpdateMealIngredientResponse{
		Meal: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) DeleteMealIngredient(ctx context.Context, req *apipb.DeleteMealIngredientRequest) (*apipb.DeleteMealIngredientResponse, error) {
	return &apipb.DeleteMealIngredientResponse{
		Meal: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) DeleteMeal(ctx context.Context, req *apipb.DeleteMealRequest) (*apipb.DeleteMealResponse, error) {
	return &apipb.DeleteMealResponse{
		Message: "DeleteMeal not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) GetSteps(ctx context.Context, req *apipb.GetStepsRequest) (*apipb.GetStepsResponse, error) {
	return &apipb.GetStepsResponse{
		Steps: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) AddStep(ctx context.Context, req *apipb.AddStepRequest) (*apipb.AddStepResponse, error) {
	return &apipb.AddStepResponse{
		Step: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) AddBulkSteps(ctx context.Context, req *apipb.AddBulkStepsRequest) (*apipb.AddBulkStepsResponse, error) {
	return &apipb.AddBulkStepsResponse{
		Steps: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) UpdateStep(ctx context.Context, req *apipb.UpdateStepRequest) (*apipb.UpdateStepResponse, error) {
	return &apipb.UpdateStepResponse{
		Step: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) DeleteStep(ctx context.Context, req *apipb.DeleteStepRequest) (*apipb.DeleteStepResponse, error) {
	return &apipb.DeleteStepResponse{
		Message: "DeleteStep not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) ReorderSteps(ctx context.Context, req *apipb.ReorderStepsRequest) (*apipb.ReorderStepsResponse, error) {
	return &apipb.ReorderStepsResponse{
		Message: "ReorderSteps not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) DeleteAllSteps(ctx context.Context, req *apipb.DeleteAllStepsRequest) (*apipb.DeleteAllStepsResponse, error) {
	return &apipb.DeleteAllStepsResponse{
		Message: "DeleteAllSteps not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) StartAgentWorkflow(ctx context.Context, req *apipb.StartAgentWorkflowRequest) (*apipb.StartAgentWorkflowResponse, error) {
	return &apipb.StartAgentWorkflowResponse{
		Response: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) MessageAgent(ctx context.Context, req *apipb.MessageAgentRequest) (*apipb.MessageAgentResponse, error) {
	return &apipb.MessageAgentResponse{
		Response: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) GetWorkflowStatus(ctx context.Context, req *apipb.GetWorkflowStatusRequest) (*apipb.GetWorkflowStatusResponse, error) {
	return &apipb.GetWorkflowStatusResponse{
		Status: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) ListWorkflows(ctx context.Context, req *emptypb.Empty) (*apipb.ListWorkflowsResponse, error) {
	return &apipb.ListWorkflowsResponse{
		Workflows: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) CancelWorkflow(ctx context.Context, req *apipb.CancelWorkflowRequest) (*apipb.CancelWorkflowResponse, error) {
	return &apipb.CancelWorkflowResponse{
		Status: "CancelWorkflow not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) GetWorkflowState(ctx context.Context, req *apipb.GetWorkflowStateRequest) (*apipb.GetWorkflowStateResponse, error) {
	return &apipb.GetWorkflowStateResponse{
		Plan:         nil,
		ShoppingList: nil,
		Messages:     nil,
	}, nil
}

func (s *MealPlannerGRPCServer) AbandonWorkflow(ctx context.Context, req *apipb.AbandonWorkflowRequest) (*apipb.AbandonWorkflowResponse, error) {
	return &apipb.AbandonWorkflowResponse{
		Message: "AbandonWorkflow not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) AddMessage(ctx context.Context, req *apipb.AddMessageRequest) (*apipb.AddMessageResponse, error) {
	return &apipb.AddMessageResponse{
		Message: "AddMessage not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) UpdateSessionState(ctx context.Context, req *apipb.UpdateSessionStateRequest) (*apipb.UpdateSessionStateResponse, error) {
	return &apipb.UpdateSessionStateResponse{
		Message: "UpdateSessionState not yet implemented",
	}, nil
}

func (s *MealPlannerGRPCServer) GetCheckpoint(ctx context.Context, req *apipb.GetCheckpointRequest) (*apipb.GetCheckpointResponse, error) {
	return &apipb.GetCheckpointResponse{
		Tuple: nil,
		Found: false,
	}, nil
}

func (s *MealPlannerGRPCServer) PutCheckpoint(ctx context.Context, req *apipb.PutCheckpointRequest) (*apipb.PutCheckpointResponse, error) {
	return &apipb.PutCheckpointResponse{
		Success: false,
	}, nil
}

func (s *MealPlannerGRPCServer) ListCheckpoints(ctx context.Context, req *apipb.ListCheckpointsRequest) (*apipb.ListCheckpointsResponse, error) {
	return &apipb.ListCheckpointsResponse{
		Entries: nil,
	}, nil
}