package main

import (
	"context"
	"fmt"
	"time"
	"encoding/json"
	"os/exec"
	"bytes"

	apipb "mealplanner/generated/go"
	"mealplanner/handlers"
	"mealplanner/models"

	"google.golang.org/protobuf/types/known/emptypb"
)

type MealPlannerGRPCServer struct {
	apipb.UnimplementedMealPlannerAPIServer
}

// runAgentCLI executes the agent CLI and returns the parsed response
func runAgentCLI(ctx context.Context, args ...string) (models.AgentResponse, error) {
	allArgs := append([]string{"../typescript/agent/dist/cli.js", "--json"}, args...)
	cmd := exec.CommandContext(ctx, "node", allArgs...)
	var stdoutBuffer, stderrBuffer bytes.Buffer
	cmd.Stdout = &stdoutBuffer
	cmd.Stderr = &stderrBuffer
	
	err := cmd.Run()
	if err != nil {
		errMsg := "agent CLI execution failed: " + err.Error()
		if stderrBuffer.Len() > 0 {
			errMsg += "\nStderr: " + stderrBuffer.String()
		}
		return models.AgentResponse{}, fmt.Errorf("%s", errMsg)
	}
	
	var resp models.AgentResponse
	if err := json.Unmarshal(stdoutBuffer.Bytes(), &resp); err != nil {
		return models.AgentResponse{}, fmt.Errorf("failed to unmarshal agent response: %v", err)
	}
	return resp, nil
}

// joinParticipants converts a slice of participants to a comma-separated string
func joinParticipants(p []string) string {
	if len(p) == 0 {
		return ""
	}
	s := p[0]
	for _, v := range p[1:] {
		s += "," + v
	}
	return s
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
	// Check database connection
	if handlers.DB == nil {
		return &apipb.ReconnectResponse{
			Status:  "error",
			Message: "Database not connected. Make sure Docker is running and the database container is started.",
		}, nil
	}
	
	if err := handlers.DB.Ping(); err == nil {
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
	if req.Plan == nil {
		return nil, fmt.Errorf("meal plan is required")
	}
	
	// For now, just return success as finalization logic needs to be implemented
	return &apipb.FinalizeMealPlanResponse{
		Message: "Meal plan finalized successfully",
	}, nil
}

func (s *MealPlannerGRPCServer) GetMealPlanICS(ctx context.Context, req *emptypb.Empty) (*apipb.MealPlanICSResponse, error) {
	return &apipb.MealPlanICSResponse{
		IcsData: []byte(""),
	}, nil
}

func (s *MealPlannerGRPCServer) GetShoppingList(ctx context.Context, req *apipb.GetShoppingListRequest) (*apipb.GetShoppingListResponse, error) {
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

func (s *MealPlannerGRPCServer) GetAllMeals(ctx context.Context, req *apipb.GetAllMealsRequest) (*apipb.GetAllMealsResponse, error) {
	meals, err := handlers.Services.MealService.GetAllMeals()
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

func (s *MealPlannerGRPCServer) CreateMeal(ctx context.Context, req *apipb.CreateMealRequest) (*apipb.CreateMealResponse, error) {
	if req.Meal == nil {
		return nil, fmt.Errorf("meal is required")
	}
	
	if req.Meal.Name == "" {
		return nil, fmt.Errorf("meal name is required")
	}
	
	meal, err := handlers.Services.MealService.CreateMeal(req.Meal)
	if err != nil {
		return nil, fmt.Errorf("error creating meal: %w", err)
	}
	
	return &apipb.CreateMealResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerGRPCServer) SwapMeal(ctx context.Context, req *apipb.SwapMealRequest) (*apipb.SwapMealResponse, error) {
	meal, err := handlers.Services.MealService.SwapMeal(int(req.MealId), req.MealType)
	if err != nil {
		return nil, fmt.Errorf("error swapping meal: %w", err)
	}
	
	return &apipb.SwapMealResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerGRPCServer) RemoveMeal(ctx context.Context, req *apipb.RemoveMealRequest) (*apipb.RemoveMealResponse, error) {
	// Get the current meal plan from the workflow
	plan, err := handlers.Services.WorkflowService.GetMealPlan(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("error getting meal plan: %w", err)
	}
	
	err = handlers.Services.MealPlanService.RemoveMealFromPlan(plan, int(req.DayIndex), req.MealType)
	if err != nil {
		return nil, fmt.Errorf("error removing meal from plan: %w", err)
	}
	
	return &apipb.RemoveMealResponse{
		Plan: plan,
	}, nil
}

func (s *MealPlannerGRPCServer) ReplaceMeal(ctx context.Context, req *apipb.ReplaceMealRequest) (*apipb.ReplaceMealResponse, error) {
	// For now, return a simple success response as replace logic needs to be implemented
	return &apipb.ReplaceMealResponse{
		Meal: nil,
	}, nil
}

func (s *MealPlannerGRPCServer) UpdateMealIngredient(ctx context.Context, req *apipb.UpdateMealIngredientRequest) (*apipb.UpdateMealIngredientResponse, error) {
	if req.Ingredient == nil {
		return nil, fmt.Errorf("ingredient is required")
	}
	
	err := handlers.Services.IngredientService.UpdateMealIngredient(int(req.MealId), req.Ingredient)
	if err != nil {
		return nil, fmt.Errorf("error updating meal ingredient: %w", err)
	}
	
	// Get updated meal to return
	meal, err := handlers.Services.MealService.GetMealByID(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error retrieving updated meal: %w", err)
	}
	
	return &apipb.UpdateMealIngredientResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerGRPCServer) DeleteMealIngredient(ctx context.Context, req *apipb.DeleteMealIngredientRequest) (*apipb.DeleteMealIngredientResponse, error) {
	err := handlers.Services.IngredientService.DeleteMealIngredient(int(req.IngredientId))
	if err != nil {
		return nil, fmt.Errorf("error deleting meal ingredient: %w", err)
	}
	
	// Get updated meal to return
	meal, err := handlers.Services.MealService.GetMealByID(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error retrieving updated meal: %w", err)
	}
	
	return &apipb.DeleteMealIngredientResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerGRPCServer) DeleteMeal(ctx context.Context, req *apipb.DeleteMealRequest) (*apipb.DeleteMealResponse, error) {
	err := handlers.Services.MealService.DeleteMeal(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error deleting meal: %w", err)
	}
	
	return &apipb.DeleteMealResponse{
		Message: "Meal deleted successfully",
	}, nil
}

func (s *MealPlannerGRPCServer) GetSteps(ctx context.Context, req *apipb.GetStepsRequest) (*apipb.GetStepsResponse, error) {
	steps, err := handlers.Services.RecipeStepService.GetStepsForMeal(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error getting steps: %w", err)
	}
	
	return &apipb.GetStepsResponse{
		Steps: steps,
	}, nil
}

func (s *MealPlannerGRPCServer) AddStep(ctx context.Context, req *apipb.AddStepRequest) (*apipb.AddStepResponse, error) {
	if req.Step == nil {
		return nil, fmt.Errorf("step is required")
	}
	
	// The service expects a protobuf Step
	req.Step.MealId = req.MealId
	createdStep, err := handlers.Services.RecipeStepService.AddStepToMeal(req.Step)
	if err != nil {
		return nil, fmt.Errorf("error adding step: %w", err)
	}
	
	return &apipb.AddStepResponse{
		Step: createdStep,
	}, nil
}

func (s *MealPlannerGRPCServer) AddBulkSteps(ctx context.Context, req *apipb.AddBulkStepsRequest) (*apipb.AddBulkStepsResponse, error) {
	steps, err := handlers.Services.RecipeStepService.AddMultipleStepsToMeal(int(req.MealId), req.Instructions)
	if err != nil {
		return nil, fmt.Errorf("error adding bulk steps: %w", err)
	}
	
	return &apipb.AddBulkStepsResponse{
		Steps: steps,
	}, nil
}

func (s *MealPlannerGRPCServer) UpdateStep(ctx context.Context, req *apipb.UpdateStepRequest) (*apipb.UpdateStepResponse, error) {
	if req.Step == nil {
		return nil, fmt.Errorf("step is required")
	}
	
	// Ensure IDs are set correctly
	req.Step.Id = req.StepId
	req.Step.MealId = req.MealId
	
	err := handlers.Services.RecipeStepService.UpdateStep(req.Step)
	if err != nil {
		return nil, fmt.Errorf("error updating step: %w", err)
	}
	
	return &apipb.UpdateStepResponse{
		Step: req.Step,
	}, nil
}

func (s *MealPlannerGRPCServer) DeleteStep(ctx context.Context, req *apipb.DeleteStepRequest) (*apipb.DeleteStepResponse, error) {
	err := handlers.Services.RecipeStepService.DeleteStep(int(req.StepId), int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error deleting step: %w", err)
	}
	
	return &apipb.DeleteStepResponse{
		Message: "Step deleted successfully",
	}, nil
}

func (s *MealPlannerGRPCServer) ReorderSteps(ctx context.Context, req *apipb.ReorderStepsRequest) (*apipb.ReorderStepsResponse, error) {
	stepIds := make([]int, len(req.StepIds))
	for i, id := range req.StepIds {
		stepIds[i] = int(id)
	}
	
	err := handlers.Services.RecipeStepService.ReorderSteps(int(req.MealId), stepIds)
	if err != nil {
		return nil, fmt.Errorf("error reordering steps: %w", err)
	}
	
	return &apipb.ReorderStepsResponse{
		Message: "Steps reordered successfully",
	}, nil
}

func (s *MealPlannerGRPCServer) DeleteAllSteps(ctx context.Context, req *apipb.DeleteAllStepsRequest) (*apipb.DeleteAllStepsResponse, error) {
	err := handlers.Services.RecipeStepService.DeleteAllStepsForMeal(int(req.MealId))
	if err != nil {
		return nil, fmt.Errorf("error deleting all steps: %w", err)
	}
	
	return &apipb.DeleteAllStepsResponse{
		Message: "All steps deleted successfully",
	}, nil
}

func (s *MealPlannerGRPCServer) StartAgentWorkflow(ctx context.Context, req *apipb.StartAgentWorkflowRequest) (*apipb.StartAgentWorkflowResponse, error) {
	if req.Request == nil {
		return nil, fmt.Errorf("request is required")
	}
	if len(req.Request.Participants) == 0 {
		return nil, fmt.Errorf("participants required")
	}
	if req.Request.WorkflowType == "" {
		return nil, fmt.Errorf("workflow_type required")
	}
	
	// Convert to models format for CLI execution
	startReq := models.AgentStartRequest{
		Participants: req.Request.Participants,
		WorkflowType: req.Request.WorkflowType,
	}
	
	ctxTimeout, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	
	resp, err := runAgentCLI(ctxTimeout, "plan", "start", "--participants", joinParticipants(startReq.Participants))
	if err != nil {
		return nil, fmt.Errorf("agent CLI execution failed: %w", err)
	}
	
	// Initialize workflow checkpoint if thread ID returned
	if resp.ThreadID != "" {
		if resp.InitialState != nil {
			var stateMap map[string]interface{}
			if b, err := json.Marshal(resp.InitialState); err == nil {
				_ = json.Unmarshal(b, &stateMap)
			}
			if stateMap == nil {
				stateMap = map[string]interface{}{}
			}
			// Remove deprecated fields
			delete(stateMap, "workflow_type")
			delete(stateMap, "channel_values")
			
			checkpoint := map[string]interface{}{
				"state": stateMap,
				"next":  []interface{}{},
				"step":  0,
			}
			if data, err := json.Marshal(checkpoint); err == nil {
				handlers.Services.WorkflowService.UpdateWorkflowCheckpoint(resp.ThreadID, data)
			}
		}
		
		// Add initial agent message if present
		if resp.Message != "" {
			t := time.Now().Format(time.RFC3339)
			handlers.Services.WorkflowService.AddAgentMessage(resp.ThreadID, resp.Message, t)
		}
	}
	
	// Convert response to protobuf format
	pbResp := &apipb.AgentResponse{
		Success:     resp.Success,
		Message:     resp.Message,
		ThreadId:    resp.ThreadID,
		CurrentStep: resp.CurrentStep,
	}
	
	return &apipb.StartAgentWorkflowResponse{
		Response: pbResp,
	}, nil
}

func (s *MealPlannerGRPCServer) MessageAgent(ctx context.Context, req *apipb.MessageAgentRequest) (*apipb.MessageAgentResponse, error) {
	if req.Request == nil {
		return nil, fmt.Errorf("request is required")
	}
	if req.Request.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	if req.Request.Message == "" {
		return nil, fmt.Errorf("message required")
	}
	if req.Request.From == "" {
		return nil, fmt.Errorf("from required")
	}
	
	// Store user message in database
	if req.Request.From == "user" && req.Request.Message != "" {
		t := time.Now().Format(time.RFC3339)
		handlers.Services.WorkflowService.AddUserFeedback(req.Request.ThreadId, req.Request.From, req.Request.Message, t)
	}
	
	ctxTimeout, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	
	// Run feedback
	_, err := runAgentCLI(ctxTimeout, "plan", "feedback", req.Request.ThreadId, req.Request.Message, "--from", req.Request.From)
	if err != nil {
		return nil, fmt.Errorf("agent CLI feedback failed: %w", err)
	}
	
	// Run resume
	resumeArgs := []string{"resume", req.Request.ThreadId}
	if req.Request.Interactive {
		resumeArgs = append(resumeArgs, "--interactive")
	}
	
	resp, err := runAgentCLI(ctxTimeout, resumeArgs...)
	if err != nil {
		return nil, fmt.Errorf("agent CLI resume failed: %w", err)
	}
	
	// Add agent response message
	if resp.Message != "" {
		t := time.Now().Format(time.RFC3339)
		handlers.Services.WorkflowService.AddAgentMessage(req.Request.ThreadId, resp.Message, t)
	}
	
	// Convert response to protobuf format
	pbResp := &apipb.AgentResponse{
		Success:     resp.Success,
		Message:     resp.Message,
		ThreadId:    resp.ThreadID,
		CurrentStep: resp.CurrentStep,
	}
	
	return &apipb.MessageAgentResponse{
		Response: pbResp,
	}, nil
}

func (s *MealPlannerGRPCServer) GetWorkflowStatus(ctx context.Context, req *apipb.GetWorkflowStatusRequest) (*apipb.GetWorkflowStatusResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	
	state, err := handlers.Services.WorkflowService.GetWorkflowState(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow state: %w", err)
	}
	
	// Convert internal state to protobuf format
	status := &apipb.WorkflowStatus{
		ThreadId:     state.ThreadID,
		WorkflowType: state.WorkflowType,
		CurrentStep:  state.CurrentStep,
		Participants: state.Participants,
	}
	
	return &apipb.GetWorkflowStatusResponse{
		Status: status,
	}, nil
}

func (s *MealPlannerGRPCServer) ListWorkflows(ctx context.Context, req *emptypb.Empty) (*apipb.ListWorkflowsResponse, error) {
	// Return empty list for now to allow agent initialization
	return &apipb.ListWorkflowsResponse{
		Workflows: []*apipb.WorkflowStatus{},
	}, nil
}

func (s *MealPlannerGRPCServer) CancelWorkflow(ctx context.Context, req *apipb.CancelWorkflowRequest) (*apipb.CancelWorkflowResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	
	// Mark workflow as ABANDONED in the DB
	err := handlers.Services.WorkflowService.UpdateWorkflowCheckpointWithMessage(req.ThreadId, "system", "ABANDONED")
	if err != nil {
		return nil, fmt.Errorf("failed to abandon workflow: %w", err)
	}
	
	return &apipb.CancelWorkflowResponse{
		Status: "ABANDONED",
	}, nil
}

func (s *MealPlannerGRPCServer) GetWorkflowState(ctx context.Context, req *apipb.GetWorkflowStateRequest) (*apipb.GetWorkflowStateResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	
	state, err := handlers.Services.WorkflowService.GetWorkflowState(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow state: %w", err)
	}
	
	// Convert shopping list items to protobuf format
	shoppingListItems := make([]*apipb.ShoppingListItem, len(state.ShoppingList))
	for i, item := range state.ShoppingList {
		shoppingListItems[i] = &item  // ShoppingListItem is an alias to apipb.ShoppingListItem
	}
	
	// Convert agent messages to protobuf format
	messages := make([]*apipb.Message, len(state.AgentMessages))
	for i, msg := range state.AgentMessages {
		messages[i] = &apipb.Message{
			Sender:    msg.Sender,
			Content:   msg.Text,
			CreatedAt: msg.Timestamp,
		}
	}
	
	// Create shopping list wrapper
	shoppingList := &apipb.ShoppingList{
		Items: shoppingListItems,
	}
	
	return &apipb.GetWorkflowStateResponse{
		Plan:         state.MealPlan,
		ShoppingList: shoppingList,
		Messages:     messages,
	}, nil
}

func (s *MealPlannerGRPCServer) AbandonWorkflow(ctx context.Context, req *apipb.AbandonWorkflowRequest) (*apipb.AbandonWorkflowResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	
	err := handlers.Services.WorkflowService.UpdateWorkflowCheckpointWithMessage(req.ThreadId, "system", "ABANDONED")
	if err != nil {
		return nil, fmt.Errorf("failed to abandon workflow: %w", err)
	}
	
	return &apipb.AbandonWorkflowResponse{
		Message: "Workflow abandoned successfully",
	}, nil
}

func (s *MealPlannerGRPCServer) AddMessage(ctx context.Context, req *apipb.AddMessageRequest) (*apipb.AddMessageResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	if req.Message == "" {
		return nil, fmt.Errorf("message required")
	}
	if req.Sender == "" {
		return nil, fmt.Errorf("sender required")
	}
	
	_, err := handlers.Services.WorkflowService.AddMessage(req.ThreadId, req.Sender, req.Message)
	if err != nil {
		return nil, fmt.Errorf("failed to add message: %w", err)
	}
	
	return &apipb.AddMessageResponse{
		Message: "Message added successfully",
	}, nil
}

func (s *MealPlannerGRPCServer) UpdateSessionState(ctx context.Context, req *apipb.UpdateSessionStateRequest) (*apipb.UpdateSessionStateResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	
	// Create state update map
	stateUpdate := map[string]interface{}{
		"meal_plan":     req.MealPlan,
		"shopping_list": req.ShoppingList,
		"current_step":  req.CurrentStep,
		"status":        req.Status,
	}
	
	data, err := json.Marshal(stateUpdate)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal state update: %w", err)
	}
	
	err = handlers.Services.WorkflowService.UpdateWorkflowCheckpoint(req.ThreadId, data)
	if err != nil {
		return nil, fmt.Errorf("failed to update session state: %w", err)
	}
	
	return &apipb.UpdateSessionStateResponse{
		Message: "Session state updated successfully",
	}, nil
}

func (s *MealPlannerGRPCServer) GetCheckpoint(ctx context.Context, req *apipb.GetCheckpointRequest) (*apipb.GetCheckpointResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	
	tuple, _, err := handlers.Services.WorkflowService.GetWorkflowCheckpoint(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to get checkpoint: %w", err)
	}
	
	// Create a basic checkpoint tuple wrapper
	checkpointTuple := &apipb.CheckpointTuple{
		Checkpoint: &apipb.AgentCheckpoint{},
		Metadata:   &apipb.AgentCheckpointMetadata{},
	}
	
	return &apipb.GetCheckpointResponse{
		Tuple: checkpointTuple,
		Found: tuple != nil,
	}, nil
}

func (s *MealPlannerGRPCServer) PutCheckpoint(ctx context.Context, req *apipb.PutCheckpointRequest) (*apipb.PutCheckpointResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	if req.Checkpoint == nil {
		return nil, fmt.Errorf("checkpoint required")
	}
	
	// Convert checkpoint to bytes for storage
	checkpointData, err := json.Marshal(req.Checkpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal checkpoint: %w", err)
	}
	
	err = handlers.Services.WorkflowService.UpdateWorkflowCheckpoint(req.ThreadId, checkpointData)
	if err != nil {
		return nil, fmt.Errorf("failed to put checkpoint: %w", err)
	}
	
	return &apipb.PutCheckpointResponse{
		Success: true,
	}, nil
}

func (s *MealPlannerGRPCServer) ListCheckpoints(ctx context.Context, req *apipb.ListCheckpointsRequest) (*apipb.ListCheckpointsResponse, error) {
	entries, err := handlers.Services.CheckpointService.ListCheckpoints(int(req.Limit), req.BeforeThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to list checkpoints: %w", err)
	}
	
	// Convert service records to protobuf format
	pbEntries := make([]*apipb.CheckpointEntry, len(entries))
	for i, entry := range entries {
		pbEntries[i] = &apipb.CheckpointEntry{
			ThreadId:     entry.ThreadID,
			CheckpointNs: entry.CheckpointNS,
			Tuple: &apipb.CheckpointTuple{
				Checkpoint: &apipb.AgentCheckpoint{},
				Metadata:   &apipb.AgentCheckpointMetadata{},
			},
		}
	}
	
	return &apipb.ListCheckpointsResponse{
		Entries: pbEntries,
	}, nil
}