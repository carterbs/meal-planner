package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"

	"google.golang.org/protobuf/encoding/protojson"

	apipb "mealplanner/generated/go"
	"mealplanner/logging"
	"mealplanner/models"
	"mealplanner/server"

	"google.golang.org/protobuf/types/known/emptypb"
)

var grpcServerLogger = logging.GetGrpcLogger("grpc-server")

type MealPlannerAPIServer struct {
	apipb.UnimplementedMealPlannerAPIServer
}

// runAgentCLI executes the agent CLI and returns the parsed response
func runAgentCLI(ctx context.Context, args ...string) (models.AgentResponse, error) {
	grpcServerLogger.Debugw("runAgentCLI: executing agent CLI", "args", args)

	allArgs := append([]string{"../agent-service/dist/cli.js", "--json"}, args...)
	cmd := exec.CommandContext(ctx, "node", allArgs...)
	var stdoutBuffer, stderrBuffer bytes.Buffer
	cmd.Stdout = &stdoutBuffer
	cmd.Stderr = &stderrBuffer

	err := cmd.Run()
	// grpcServerLogger.Debugw("runAgentCLI: command executed", "args", args, "stdout", stdoutBuffer.String(), "stderr", stderrBuffer.String())
	if err != nil {
		errMsg := "agent CLI execution failed: " + err.Error()
		if stderrBuffer.Len() > 0 {
			errMsg += "\nStderr: " + stderrBuffer.String()
		}
		grpcServerLogger.Errorw("runAgentCLI error", "args", args, "stderr", stderrBuffer.String(), "error", err)
		return models.AgentResponse{}, fmt.Errorf("%s", errMsg)
	}
	// enable if yo uwant very verbose and very long
	// grpcServerLogger.Debugw("runAgentCLI stdout", "args", args, "stdout", stdoutBuffer.String())
	if stderrBuffer.Len() > 0 {
		grpcServerLogger.Debugw("runAgentCLI stderr (non-error)", "args", args, "stderr", stderrBuffer.String())
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
	return server.Services.ShoppingListService.BuildShoppingList(mealIDs)
}

func (s *MealPlannerAPIServer) HealthCheck(ctx context.Context, req *emptypb.Empty) (*apipb.HealthCheckResponse, error) {
	if server.DB == nil {
		return &apipb.HealthCheckResponse{
			Status:  "error",
			Message: "Database not connected. Make sure Docker is running and the database container is started.",
		}, nil
	}

	if err := server.DB.Ping(); err != nil {
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
	if req.Plan == nil {
		return nil, fmt.Errorf("meal plan is required")
	}

	// For now, just return success as finalization logic needs to be implemented
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

func (s *MealPlannerAPIServer) SwapMeal(ctx context.Context, req *apipb.SwapMealRequest) (*apipb.SwapMealResponse, error) {
	meal, err := server.Services.MealService.SwapMeal(int(req.MealId), req.MealType)
	if err != nil {
		return nil, fmt.Errorf("error swapping meal: %w", err)
	}

	return &apipb.SwapMealResponse{
		Meal: meal,
	}, nil
}

func (s *MealPlannerAPIServer) RemoveMeal(ctx context.Context, req *apipb.RemoveMealRequest) (*apipb.RemoveMealResponse, error) {
	// Get the current meal plan from the workflow
	plan, err := server.Services.WorkflowService.GetMealPlan(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("error getting meal plan: %w", err)
	}

	err = server.Services.MealPlanService.RemoveMealFromPlan(plan, int(req.DayIndex), req.MealType)
	if err != nil {
		return nil, fmt.Errorf("error removing meal from plan: %w", err)
	}

	return &apipb.RemoveMealResponse{
		Plan: plan,
	}, nil
}

func (s *MealPlannerAPIServer) ReplaceMeal(ctx context.Context, req *apipb.ReplaceMealRequest) (*apipb.ReplaceMealResponse, error) {
	// For now, return a simple success response as replace logic needs to be implemented
	return &apipb.ReplaceMealResponse{
		Meal: nil,
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

func (s *MealPlannerAPIServer) StartAgentWorkflow(ctx context.Context, req *apipb.StartAgentWorkflowRequest) (*apipb.StartAgentWorkflowResponse, error) {
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

	ctxTimeout, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	resp, err := runAgentCLI(ctxTimeout, "plan", "start", "--participants", joinParticipants(startReq.Participants))
	if err != nil {
		grpcServerLogger.Errorw("MessageAgent: agent CLI feedback failed", "error", err)
		return nil, fmt.Errorf("agent CLI feedback failed: %w", err)
	}

	// Convert response to protobuf format
	pbResp := &apipb.AgentResponse{
		Success:     resp.Success,
		Message:     resp.Message,
		ThreadId:    resp.ThreadID,
		CurrentStep: resp.CurrentStep,
	}
	// Initialize workflow checkpoint if thread ID returned
	var stateMap map[string]interface{}
	if resp.ThreadID != "" {
		if resp.InitialState != nil {
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
				server.Services.WorkflowService.UpdateWorkflowCheckpoint(resp.ThreadID, data)
				pbResp.InitialState = string(data)
			}
		}

		// Add initial agent message if present
		if resp.Message != "" {
			t := time.Now().Format(time.RFC3339)
			server.Services.WorkflowService.AddAgentMessage(resp.ThreadID, resp.Message, t)
		}
	}

	return &apipb.StartAgentWorkflowResponse{
		Response: pbResp,
	}, nil
}

func (s *MealPlannerAPIServer) MessageAgent(ctx context.Context, req *apipb.MessageAgentRequest) (*apipb.MessageAgentResponse, error) {
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

	ctxTimeout, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	// Run feedback
	_, err := runAgentCLI(ctxTimeout, "plan", "feedback", req.Request.ThreadId, req.Request.Message, "--from", req.Request.From)
	if err != nil {
		grpcServerLogger.Errorw("MessageAgent: agent CLI feedback failed", "error", err)
		return nil, fmt.Errorf("agent CLI feedback failed: %w", err)
	}

	// Run resume
	resumeArgs := []string{"resume", req.Request.ThreadId}
	// Note: Don't use --interactive with --json as they are incompatible
	grpcServerLogger.Debugw("MessageAgent: invoking resume", "threadID", req.Request.ThreadId, "args", resumeArgs)
	resp, err := runAgentCLI(ctxTimeout, resumeArgs...)
	if err != nil {
		grpcServerLogger.Errorw("MessageAgent: agent CLI resume failed", "args", resumeArgs, "error", err)
		return nil, fmt.Errorf("agent CLI resume failed: %w", err)
	}
	grpcServerLogger.Debugw("MessageAgent: resume response", "threadID", req.Request.ThreadId, "success", resp.Success, "message", resp.Message, "currentStep", resp.CurrentStep)

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

func (s *MealPlannerAPIServer) GetWorkflowStatus(ctx context.Context, req *apipb.GetWorkflowStatusRequest) (*apipb.GetWorkflowStatusResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}

	state, err := server.Services.WorkflowService.GetWorkflowState(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow state: %w", err)
	}

	// Convert state to protobuf format
	status := &apipb.WorkflowStatus{
		ThreadId:     state.ThreadId,
		WorkflowType: "meal_planning", // From request context, not stored in state
		CurrentStep:  state.CurrentStep,
		Participants: state.Participants,
	}

	return &apipb.GetWorkflowStatusResponse{
		Status: status,
	}, nil
}

func (s *MealPlannerAPIServer) ListWorkflows(ctx context.Context, req *emptypb.Empty) (*apipb.ListWorkflowsResponse, error) {
	// Fetch latest 50 workflows (arbitrary default)
	const defaultLimit = 50
	statuses, err := server.Services.WorkflowService.ListWorkflows(defaultLimit)
	if err != nil {
		return nil, fmt.Errorf("failed to list workflows: %w", err)
	}
	pbStatuses := make([]*apipb.WorkflowStatus, len(statuses))
	for i, st := range statuses {
		pbStatuses[i] = &apipb.WorkflowStatus{
			ThreadId:     st.ThreadID,
			WorkflowType: st.WorkflowType,
			CurrentStep:  st.CurrentStep,
			Participants: st.Participants,
		}
	}
	return &apipb.ListWorkflowsResponse{Workflows: pbStatuses}, nil
}

func (s *MealPlannerAPIServer) CancelWorkflow(ctx context.Context, req *apipb.CancelWorkflowRequest) (*apipb.CancelWorkflowResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}

	// Mark workflow as ABANDONED in the DB
	err := server.Services.WorkflowService.UpdateWorkflowCheckpointWithMessage(req.ThreadId, "system", "ABANDONED")
	if err != nil {
		return nil, fmt.Errorf("failed to abandon workflow: %w", err)
	}

	return &apipb.CancelWorkflowResponse{
		Status: "ABANDONED",
	}, nil
}

func (s *MealPlannerAPIServer) GetWorkflowState(ctx context.Context, req *apipb.GetWorkflowStateRequest) (*apipb.GetWorkflowStateResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}

	state, err := server.Services.WorkflowService.GetWorkflowState(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow state: %w", err)
	}

	// Convert shopping list to protobuf format
	var shoppingListItems []*apipb.ShoppingListItem
	if state.ShoppingList != nil {
		shoppingListItems = state.ShoppingList.Items
	}

	// Create shopping list wrapper
	shoppingList := &apipb.ShoppingList{
		Items: shoppingListItems,
	}

	return &apipb.GetWorkflowStateResponse{
		Plan:         state.MealPlan,
		ShoppingList: shoppingList,
		Messages:     []*apipb.Message{},
	}, nil
}

func (s *MealPlannerAPIServer) AbandonWorkflow(ctx context.Context, req *apipb.AbandonWorkflowRequest) (*apipb.AbandonWorkflowResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}

	err := server.Services.WorkflowService.UpdateWorkflowCheckpointWithMessage(req.ThreadId, "system", "ABANDONED")
	if err != nil {
		return nil, fmt.Errorf("failed to abandon workflow: %w", err)
	}

	return &apipb.AbandonWorkflowResponse{
		Message: "Workflow abandoned successfully",
	}, nil
}

func (s *MealPlannerAPIServer) AddMessage(ctx context.Context, req *apipb.AddMessageRequest) (*apipb.AddMessageResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	if req.Message == "" {
		return nil, fmt.Errorf("message required")
	}
	if req.Sender == "" {
		return nil, fmt.Errorf("sender required")
	}

	_, err := server.Services.WorkflowService.AddMessage(req.ThreadId, req.Sender, req.Message)
	if err != nil {
		return nil, fmt.Errorf("failed to add message: %w", err)
	}

	return &apipb.AddMessageResponse{
		Message: "Message added successfully",
	}, nil
}

func (s *MealPlannerAPIServer) GetMessages(ctx context.Context, req *apipb.GetMessagesRequest) (*apipb.GetMessagesResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}

	messages, err := server.Services.MessageService.GetMessagesWithTimestamps(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}

	protoMessages := make([]*apipb.Message, len(messages))
	for i, msg := range messages {
		protoMessages[i] = &apipb.Message{
			ThreadId:  msg["thread_id"].(string),
			Sender:    msg["sender"].(string),
			Content:   msg["content"].(string),
			CreatedAt: msg["created_at"].(string),
		}
	}

	return &apipb.GetMessagesResponse{
		Messages: protoMessages,
	}, nil
}

func (s *MealPlannerAPIServer) UpdateSessionState(ctx context.Context, req *apipb.UpdateSessionStateRequest) (*apipb.UpdateSessionStateResponse, error) {
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

	err = server.Services.WorkflowService.UpdateWorkflowCheckpoint(req.ThreadId, data)
	if err != nil {
		return nil, fmt.Errorf("failed to update session state: %w", err)
	}

	return &apipb.UpdateSessionStateResponse{
		Message: "Session state updated successfully",
	}, nil
}

func (s *MealPlannerAPIServer) GetCheckpoint(ctx context.Context, req *apipb.GetCheckpointRequest) (*apipb.GetCheckpointResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}

	data, ns, err := server.Services.WorkflowService.GetWorkflowCheckpoint(req.ThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to get checkpoint: %w", err)
	}
	if data == nil || len(data) == 0 {
		// Not found
		return &apipb.GetCheckpointResponse{Found: false}, nil
	}

	// Unmarshal checkpoint data into protobuf AgentCheckpoint (without messages)
	var checkpoint apipb.AgentCheckpoint
	um := protojson.UnmarshalOptions{DiscardUnknown: true}
	if err := um.Unmarshal(data, &checkpoint); err != nil {
		return nil, fmt.Errorf("failed to unmarshal stored checkpoint: %w", err)
	}

	// Metadata is currently not stored separately; return empty with step if available
	meta := &apipb.AgentCheckpointMetadata{}
	if checkpoint.Step != 0 {
		meta.Step = checkpoint.Step
	}
	checkpointTuple := &apipb.CheckpointTuple{
		Checkpoint: &checkpoint,
		Metadata:   meta,
	}
	grpcServerLogger.Debugw("Debuggyz: GetCheckpoint: returning checkpoint", "threadID", req.ThreadId, "ns", ns, "currentStep", checkpoint.State.GetCurrentStep())
	return &apipb.GetCheckpointResponse{
		Tuple: checkpointTuple,
		Found: true,
	}, nil
}

func (s *MealPlannerAPIServer) PutCheckpoint(ctx context.Context, req *apipb.PutCheckpointRequest) (*apipb.PutCheckpointResponse, error) {
	if req.ThreadId == "" {
		return nil, fmt.Errorf("threadId required")
	}
	if req.Checkpoint == nil {
		return nil, fmt.Errorf("checkpoint required")
	}

	grpcServerLogger.Debugw("Debuggyz: PutCheckpoint called", "threadID", req.ThreadId, "incomingWorkflowType", req.WorkflowType, "CurrentStep", req.Checkpoint.GetState().GetCurrentStep())
	// Choose protojson options once for consistent naming / enums
	marshalOpts := protojson.MarshalOptions{UseProtoNames: true}

	// Ensure workflowType is always populated – fall back to MEAL_PLANNING for
	// older agents that don't send it explicitly.
	workflowType := req.WorkflowType
	if workflowType == "" {
		workflowType = "meal_planning"
	}

	// Messages are now stored separately in the messages table

	// Marshal checkpoint to JSON first (canonical protojson output).
	checkpointData, err := marshalOpts.Marshal(req.Checkpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal checkpoint: %w", err)
	}

	// Metadata is optional – marshal when present.
	var metaDataBytes []byte
	if req.Metadata != nil {
		metaDataBytes, err = marshalOpts.Marshal(req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal checkpoint metadata: %w", err)
		}
	}

	ns := req.CheckpointNs
	if ns == "" {
		ns = "latest"
	}

	// Persist via checkpoint service – service is responsible for UPSERT logic.
	if err := server.Services.CheckpointService.PutCheckpoint(req.ThreadId, ns, workflowType, checkpointData, metaDataBytes); err != nil {
		return nil, fmt.Errorf("failed to put checkpoint: %w", err)
	}
	return &apipb.PutCheckpointResponse{
		Success:      true,
		ThreadId:     req.ThreadId,
		CheckpointNs: ns,
	}, nil
}

func (s *MealPlannerAPIServer) ListCheckpoints(ctx context.Context, req *apipb.ListCheckpointsRequest) (*apipb.ListCheckpointsResponse, error) {
	entries, err := server.Services.CheckpointService.ListCheckpoints(int(req.Limit), req.BeforeThreadId)
	if err != nil {
		return nil, fmt.Errorf("failed to list checkpoints: %w", err)
	}

	// Convert service records to protobuf format
	pbEntries := make([]*apipb.CheckpointEntry, len(entries))
	for i, entry := range entries {
		// Unmarshal stored bytes back to proto objects when possible
		var cp apipb.AgentCheckpoint
		_ = protojson.Unmarshal(entry.Checkpoint, &cp) // ignore error, fallback to empty
		var meta apipb.AgentCheckpointMetadata
		_ = protojson.Unmarshal(entry.Metadata, &meta)

		pbEntries[i] = &apipb.CheckpointEntry{
			ThreadId:     entry.ThreadID,
			CheckpointNs: entry.CheckpointNS,
			Tuple: &apipb.CheckpointTuple{
				Checkpoint: &cp,
				Metadata:   &meta,
			},
		}
	}

	return &apipb.ListCheckpointsResponse{
		Entries: pbEntries,
	}, nil
}
