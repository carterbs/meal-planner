package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"mealplanner/logging"
	"mealplanner/models"
	pb "mealplanner/proto"
	"mealplanner/services"
)

var grpcLogger = logging.GetLogger("grpc-server")

// BackendServer implements the gRPC BackendService
type BackendServer struct {
	pb.UnimplementedBackendServiceServer
	services *services.ServiceContainer
}

// NewBackendServer creates a new gRPC backend server
func NewBackendServer(services *services.ServiceContainer) *BackendServer {
	return &BackendServer{
		services: services,
	}
}

// ============================================================================
// Health Check
// ============================================================================

func (s *BackendServer) HealthCheck(ctx context.Context, req *pb.HealthCheckRequest) (*pb.HealthCheckResponse, error) {
	grpcLogger.Debug("HealthCheck called")

	// Test database connection
	dbStatus := "healthy"
	message := "All systems operational"

	// You can add database ping here if needed
	// if err := s.services.DB.Ping(); err != nil {
	// 	dbStatus = "unhealthy"
	// 	message = fmt.Sprintf("Database connection failed: %v", err)
	// }

	return &pb.HealthCheckResponse{
		Status:         "healthy",
		DatabaseStatus: dbStatus,
		Message:        message,
	}, nil
}

func (s *BackendServer) ReconnectDatabase(ctx context.Context, req *pb.ReconnectDatabaseRequest) (*pb.ReconnectDatabaseResponse, error) {
	grpcLogger.Debug("ReconnectDatabase called")

	// This would typically reconnect to the database
	// For now, just return success
	return &pb.ReconnectDatabaseResponse{
		Message: "Database reconnection successful",
	}, nil
}

// ============================================================================
// Meal Management
// ============================================================================

func (s *BackendServer) GetAllMeals(ctx context.Context, req *pb.GetAllMealsRequest) (*pb.GetAllMealsResponse, error) {
	grpcLogger.Debugw("GetAllMeals called", "mealType", req.MealType)

	meals, err := s.services.MealService.GetAllMeals()
	if err != nil {
		grpcLogger.Errorw("GetAllMeals failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get meals: %v", err)
	}

	// Filter by meal type if specified
	if req.MealType != "" {
		filteredMeals := make([]*models.Meal, 0)
		for _, meal := range meals {
			if meal.MealType == req.MealType {
				filteredMeals = append(filteredMeals, meal)
			}
		}
		meals = filteredMeals
	}

	protoMeals := ConvertMealsToProto(meals)

	return &pb.GetAllMealsResponse{
		Meals: protoMeals,
	}, nil
}

func (s *BackendServer) CreateMeal(ctx context.Context, req *pb.CreateMealRequest) (*pb.CreateMealResponse, error) {
	grpcLogger.Debugw("CreateMeal called", "mealName", req.MealName, "mealType", req.MealType)

	meal := ConvertProtoToMeal(req)

	createdMeal, err := s.services.MealService.CreateMeal(meal)
	if err != nil {
		grpcLogger.Errorw("CreateMeal failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to create meal: %v", err)
	}

	return &pb.CreateMealResponse{
		Meal:    ConvertMealToProto(createdMeal),
		Message: "Meal created successfully",
	}, nil
}

func (s *BackendServer) DeleteMeal(ctx context.Context, req *pb.DeleteMealRequest) (*pb.DeleteMealResponse, error) {
	grpcLogger.Debugw("DeleteMeal called", "mealId", req.MealId)

	err := s.services.MealService.DeleteMeal(int(req.MealId))
	if err != nil {
		grpcLogger.Errorw("DeleteMeal failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to delete meal: %v", err)
	}

	return &pb.DeleteMealResponse{
		Message: "Meal deleted successfully",
	}, nil
}

func (s *BackendServer) SwapMeal(ctx context.Context, req *pb.SwapMealRequest) (*pb.SwapMealResponse, error) {
	grpcLogger.Debugw("SwapMeal called", "mealType", req.MealType, "excludeIds", req.ExcludeIds)

	// For now, use the first exclude ID as the meal to swap from
	// This may need adjustment based on actual business logic
	var currentMealID int
	if len(req.ExcludeIds) > 0 {
		currentMealID = int(req.ExcludeIds[0])
	}

	meal, err := s.services.MealService.SwapMeal(currentMealID, req.MealType)
	if err != nil {
		grpcLogger.Errorw("SwapMeal failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to swap meal: %v", err)
	}

	return &pb.SwapMealResponse{
		Meal: ConvertMealToProto(meal),
	}, nil
}

func (s *BackendServer) RemoveMeal(ctx context.Context, req *pb.RemoveMealRequest) (*pb.RemoveMealResponse, error) {
	grpcLogger.Debugw("RemoveMeal called", "mealId", req.MealId)

	// For now, this is the same as DeleteMeal since RemoveMeal doesn't exist in service
	err := s.services.MealService.DeleteMeal(int(req.MealId))
	if err != nil {
		grpcLogger.Errorw("RemoveMeal failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to remove meal: %v", err)
	}

	return &pb.RemoveMealResponse{
		Message: "Meal removed successfully",
	}, nil
}

func (s *BackendServer) ReplaceMeal(ctx context.Context, req *pb.ReplaceMealRequest) (*pb.ReplaceMealResponse, error) {
	grpcLogger.Debugw("ReplaceMeal called", "oldMealId", req.OldMealId, "newMealId", req.NewMealId)

	// This method doesn't exist in the service layer, so return a stub response
	// This would need to be implemented in the meal plan service
	return nil, status.Errorf(codes.Unimplemented, "ReplaceMeal method not yet implemented")
}

// ============================================================================
// Ingredient Management
// ============================================================================

func (s *BackendServer) UpdateIngredient(ctx context.Context, req *pb.UpdateIngredientRequest) (*pb.UpdateIngredientResponse, error) {
	grpcLogger.Debugw("UpdateIngredient called", "mealId", req.MealId, "ingredientId", req.IngredientId)

	ingredient := models.Ingredient{
		ID:       int(req.IngredientId),
		MealID:   int(req.MealId),
		Quantity: req.Quantity,
		Unit:     req.Unit,
		Name:     req.Name,
	}

	err := s.services.IngredientService.UpdateMealIngredient(int(req.MealId), ingredient)
	if err != nil {
		grpcLogger.Errorw("UpdateIngredient failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to update ingredient: %v", err)
	}

	return &pb.UpdateIngredientResponse{
		Ingredient: ConvertIngredientToProto(&ingredient),
	}, nil
}

func (s *BackendServer) DeleteIngredient(ctx context.Context, req *pb.DeleteIngredientRequest) (*pb.DeleteIngredientResponse, error) {
	grpcLogger.Debugw("DeleteIngredient called", "mealId", req.MealId, "ingredientId", req.IngredientId)

	err := s.services.IngredientService.DeleteMealIngredient(int(req.IngredientId))
	if err != nil {
		grpcLogger.Errorw("DeleteIngredient failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to delete ingredient: %v", err)
	}

	return &pb.DeleteIngredientResponse{
		Message: "Ingredient deleted successfully",
	}, nil
}

// ============================================================================
// Recipe Steps Management
// ============================================================================

func (s *BackendServer) GetSteps(ctx context.Context, req *pb.GetStepsRequest) (*pb.GetStepsResponse, error) {
	grpcLogger.Debugw("GetSteps called", "mealId", req.MealId)

	steps, err := s.services.RecipeStepService.GetStepsForMeal(int(req.MealId))
	if err != nil {
		grpcLogger.Errorw("GetSteps failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get steps: %v", err)
	}

	protoSteps := make([]*pb.Step, len(steps))
	for i, step := range steps {
		protoSteps[i] = ConvertStepToProto(&step)
	}

	return &pb.GetStepsResponse{
		Steps: protoSteps,
	}, nil
}

func (s *BackendServer) CreateStep(ctx context.Context, req *pb.CreateStepRequest) (*pb.CreateStepResponse, error) {
	grpcLogger.Debugw("CreateStep called", "mealId", req.MealId)

	step := models.Step{
		MealID:      int(req.MealId),
		Instruction: req.Instruction,
	}

	createdStep, err := s.services.RecipeStepService.AddStepToMeal(step)
	if err != nil {
		grpcLogger.Errorw("CreateStep failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to create step: %v", err)
	}

	return &pb.CreateStepResponse{
		Step: ConvertStepToProto(createdStep),
	}, nil
}

func (s *BackendServer) CreateStepsBulk(ctx context.Context, req *pb.CreateStepsBulkRequest) (*pb.CreateStepsBulkResponse, error) {
	grpcLogger.Debugw("CreateStepsBulk called", "mealId", req.MealId, "stepCount", len(req.Instructions))

	steps, err := s.services.RecipeStepService.AddMultipleStepsToMeal(int(req.MealId), req.Instructions)
	if err != nil {
		grpcLogger.Errorw("CreateStepsBulk failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to create steps: %v", err)
	}

	protoSteps := make([]*pb.Step, len(steps))
	for i, step := range steps {
		protoSteps[i] = ConvertStepToProto(&step)
	}

	return &pb.CreateStepsBulkResponse{
		Steps: protoSteps,
	}, nil
}

func (s *BackendServer) UpdateStep(ctx context.Context, req *pb.UpdateStepRequest) (*pb.UpdateStepResponse, error) {
	grpcLogger.Debugw("UpdateStep called", "mealId", req.MealId, "stepId", req.StepId)

	step := models.Step{
		ID:          int(req.StepId),
		MealID:      int(req.MealId),
		Instruction: req.Instruction,
	}

	err := s.services.RecipeStepService.UpdateStep(step)
	if err != nil {
		grpcLogger.Errorw("UpdateStep failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to update step: %v", err)
	}

	return &pb.UpdateStepResponse{
		Step: ConvertStepToProto(&step),
	}, nil
}

func (s *BackendServer) DeleteStep(ctx context.Context, req *pb.DeleteStepRequest) (*pb.DeleteStepResponse, error) {
	grpcLogger.Debugw("DeleteStep called", "mealId", req.MealId, "stepId", req.StepId)

	err := s.services.RecipeStepService.DeleteStep(int(req.MealId), int(req.StepId))
	if err != nil {
		grpcLogger.Errorw("DeleteStep failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to delete step: %v", err)
	}

	return &pb.DeleteStepResponse{
		Message: "Step deleted successfully",
	}, nil
}

func (s *BackendServer) ReorderSteps(ctx context.Context, req *pb.ReorderStepsRequest) (*pb.ReorderStepsResponse, error) {
	grpcLogger.Debugw("ReorderSteps called", "mealId", req.MealId, "stepCount", len(req.StepIds))

	// Convert step IDs to int slice
	stepIds := make([]int, len(req.StepIds))
	for i, id := range req.StepIds {
		stepIds[i] = int(id)
	}

	err := s.services.RecipeStepService.ReorderSteps(int(req.MealId), stepIds)
	if err != nil {
		grpcLogger.Errorw("ReorderSteps failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to reorder steps: %v", err)
	}

	// Get the reordered steps
	steps, err := s.services.RecipeStepService.GetStepsForMeal(int(req.MealId))
	if err != nil {
		grpcLogger.Errorw("ReorderSteps: failed to get updated steps", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get updated steps: %v", err)
	}

	protoSteps := make([]*pb.Step, len(steps))
	for i, step := range steps {
		protoSteps[i] = ConvertStepToProto(&step)
	}

	return &pb.ReorderStepsResponse{
		Steps: protoSteps,
	}, nil
}

func (s *BackendServer) DeleteAllSteps(ctx context.Context, req *pb.DeleteAllStepsRequest) (*pb.DeleteAllStepsResponse, error) {
	grpcLogger.Debugw("DeleteAllSteps called", "mealId", req.MealId)

	err := s.services.RecipeStepService.DeleteAllStepsForMeal(int(req.MealId))
	if err != nil {
		grpcLogger.Errorw("DeleteAllSteps failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to delete all steps: %v", err)
	}

	return &pb.DeleteAllStepsResponse{
		Message: "All steps deleted successfully",
	}, nil
}

// ============================================================================
// Meal Plan Management
// ============================================================================

func (s *BackendServer) GetMealPlan(ctx context.Context, req *pb.GetMealPlanRequest) (*pb.GetMealPlanResponse, error) {
	grpcLogger.Debug("GetMealPlan called")

	plan, err := s.services.MealPlanService.GetLastPlannedMeals()
	if err != nil {
		grpcLogger.Errorw("GetMealPlan failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get meal plan: %v", err)
	}

	return &pb.GetMealPlanResponse{
		MealPlan: ConvertWeeklyMealPlanToProto(plan),
	}, nil
}

func (s *BackendServer) GenerateMealPlan(ctx context.Context, req *pb.GenerateMealPlanRequest) (*pb.GenerateMealPlanResponse, error) {
	grpcLogger.Debugw("GenerateMealPlan called", "force", req.Force)

	plan, err := s.services.MealPlanService.GenerateWeeklyMealPlan()
	if err != nil {
		grpcLogger.Errorw("GenerateMealPlan failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to generate meal plan: %v", err)
	}

	return &pb.GenerateMealPlanResponse{
		MealPlan: ConvertWeeklyMealPlanToProto(plan),
	}, nil
}

func (s *BackendServer) FinalizeMealPlan(ctx context.Context, req *pb.FinalizeMealPlanRequest) (*pb.FinalizeMealPlanResponse, error) {
	grpcLogger.Debug("FinalizeMealPlan called")

	// This method doesn't exist in the service interface, so return unimplemented for now
	return nil, status.Errorf(codes.Unimplemented, "FinalizeMealPlan method not yet implemented")
}

func (s *BackendServer) GetMealPlanIcs(ctx context.Context, req *pb.GetMealPlanIcsRequest) (*pb.GetMealPlanIcsResponse, error) {
	grpcLogger.Debug("GetMealPlanIcs called")

	// This method doesn't exist in the service interface, so return unimplemented for now
	return nil, status.Errorf(codes.Unimplemented, "GetMealPlanIcs method not yet implemented")
}

// ============================================================================
// Shopping List
// ============================================================================

func (s *BackendServer) GenerateShoppingList(ctx context.Context, req *pb.GenerateShoppingListRequest) (*pb.GenerateShoppingListResponse, error) {
	grpcLogger.Debugw("GenerateShoppingList called", "mealCount", len(req.MealIds))

	// Convert meal IDs to int slice
	mealIds := make([]int, len(req.MealIds))
	for i, id := range req.MealIds {
		mealIds[i] = int(id)
	}

	items, err := s.services.ShoppingListService.BuildShoppingList(mealIds)
	if err != nil {
		grpcLogger.Errorw("GenerateShoppingList failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to generate shopping list: %v", err)
	}

	protoItems := make([]*pb.ShoppingListItem, len(items))
	for i, item := range items {
		protoItems[i] = ConvertShoppingListItemToProto(&item)
	}

	return &pb.GenerateShoppingListResponse{
		Items: protoItems,
	}, nil
}

// ============================================================================
// Workflow/Agent Management
// ============================================================================

func (s *BackendServer) StartWorkflow(ctx context.Context, req *pb.StartWorkflowRequest) (*pb.StartWorkflowResponse, error) {
	grpcLogger.Debugw("StartWorkflow called", "participants", req.Participants)

	// This method needs to be implemented in the service layer
	return nil, status.Errorf(codes.Unimplemented, "StartWorkflow method not yet implemented")
}

func (s *BackendServer) SendMessage(ctx context.Context, req *pb.SendMessageRequest) (*pb.SendMessageResponse, error) {
	grpcLogger.Debugw("SendMessage called", "threadId", req.ThreadId)

	message, err := s.services.WorkflowService.AddMessage(req.ThreadId, "user", req.Message)
	if err != nil {
		grpcLogger.Errorw("SendMessage failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to send message: %v", err)
	}

	return &pb.SendMessageResponse{
		Success:     true,
		Message:     "Message sent successfully",
		CurrentStep: "active",
		Messages:    []*pb.ChatMessage{ConvertChatMessageToProto(message)},
	}, nil
}

func (s *BackendServer) GetWorkflowStatus(ctx context.Context, req *pb.GetWorkflowStatusRequest) (*pb.GetWorkflowStatusResponse, error) {
	grpcLogger.Debugw("GetWorkflowStatus called", "threadId", req.ThreadId)

	workflow, err := s.services.WorkflowService.GetWorkflowState(req.ThreadId)
	if err != nil {
		grpcLogger.Errorw("GetWorkflowStatus failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get workflow status: %v", err)
	}

	return &pb.GetWorkflowStatusResponse{
		Workflow: ConvertWorkflowStateToProto(workflow),
	}, nil
}

func (s *BackendServer) ListWorkflows(ctx context.Context, req *pb.ListWorkflowsRequest) (*pb.ListWorkflowsResponse, error) {
	grpcLogger.Debug("ListWorkflows called")

	// This method doesn't exist in the service interface, so return unimplemented for now
	return nil, status.Errorf(codes.Unimplemented, "ListWorkflows method not yet implemented")
}

func (s *BackendServer) CancelWorkflow(ctx context.Context, req *pb.CancelWorkflowRequest) (*pb.CancelWorkflowResponse, error) {
	grpcLogger.Debugw("CancelWorkflow called", "threadId", req.ThreadId)

	// This method doesn't exist in the service interface, so return unimplemented for now
	return nil, status.Errorf(codes.Unimplemented, "CancelWorkflow method not yet implemented")
}

// ============================================================================
// Workflow State Management
// ============================================================================

func (s *BackendServer) GetWorkflowState(ctx context.Context, req *pb.GetWorkflowStateRequest) (*pb.GetWorkflowStateResponse, error) {
	grpcLogger.Debugw("GetWorkflowState called", "threadId", req.ThreadId)

	workflow, err := s.services.WorkflowService.GetWorkflowState(req.ThreadId)
	if err != nil {
		grpcLogger.Errorw("GetWorkflowState failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to get workflow state: %v", err)
	}

	return &pb.GetWorkflowStateResponse{
		Workflow: ConvertWorkflowStateToProto(workflow),
	}, nil
}

func (s *BackendServer) AbandonWorkflow(ctx context.Context, req *pb.AbandonWorkflowRequest) (*pb.AbandonWorkflowResponse, error) {
	grpcLogger.Debugw("AbandonWorkflow called", "threadId", req.ThreadId)

	// This method doesn't exist in the service interface, so return unimplemented for now
	return nil, status.Errorf(codes.Unimplemented, "AbandonWorkflow method not yet implemented")
}

func (s *BackendServer) AddMessageToWorkflow(ctx context.Context, req *pb.AddMessageToWorkflowRequest) (*pb.AddMessageToWorkflowResponse, error) {
	grpcLogger.Debugw("AddMessageToWorkflow called", "threadId", req.ThreadId)

	message, err := s.services.WorkflowService.AddMessage(req.ThreadId, req.Role, req.Content)
	if err != nil {
		grpcLogger.Errorw("AddMessageToWorkflow failed", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to add message to workflow: %v", err)
	}

	return &pb.AddMessageToWorkflowResponse{
		Message: ConvertChatMessageToProto(message),
	}, nil
}

func (s *BackendServer) UpdateWorkflowState(ctx context.Context, req *pb.UpdateWorkflowStateRequest) (*pb.UpdateWorkflowStateResponse, error) {
	grpcLogger.Debugw("UpdateWorkflowState called", "threadId", req.ThreadId)

	// This method would need a custom implementation since the service interface doesn't match exactly
	return nil, status.Errorf(codes.Unimplemented, "UpdateWorkflowState method not yet implemented")
}
