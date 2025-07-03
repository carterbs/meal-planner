package grpc

import (
	"google.golang.org/protobuf/types/known/timestamppb"
	"mealplanner/models"
	pb "mealplanner/proto"
)

// ConvertMealToProto converts a models.Meal to a protobuf Meal message
func ConvertMealToProto(meal *models.Meal) *pb.Meal {
	if meal == nil {
		return nil
	}

	protoMeal := &pb.Meal{
		Id:             int32(meal.ID),
		MealName:       meal.MealName,
		MealType:       meal.MealType,
		RelativeEffort: int32(meal.RelativeEffort),
		RedMeat:        meal.RedMeat,
		Url:            meal.URL,
		Ingredients:    make([]*pb.Ingredient, len(meal.Ingredients)),
		Steps:          make([]*pb.Step, len(meal.Steps)),
	}

	// Convert last planned timestamp
	if !meal.LastPlanned.IsZero() {
		protoMeal.LastPlanned = timestamppb.New(meal.LastPlanned)
	}

	// Convert ingredients
	for i, ingredient := range meal.Ingredients {
		protoMeal.Ingredients[i] = ConvertIngredientToProto(&ingredient)
	}

	// Convert steps
	for i, step := range meal.Steps {
		protoMeal.Steps[i] = ConvertStepToProto(&step)
	}

	return protoMeal
}

// ConvertMealsToProto converts a slice of models.Meal to protobuf Meal messages
func ConvertMealsToProto(meals []*models.Meal) []*pb.Meal {
	protoMeals := make([]*pb.Meal, len(meals))
	for i, meal := range meals {
		protoMeals[i] = ConvertMealToProto(meal)
	}
	return protoMeals
}

// ConvertIngredientToProto converts a models.Ingredient to a protobuf Ingredient message
func ConvertIngredientToProto(ingredient *models.Ingredient) *pb.Ingredient {
	if ingredient == nil {
		return nil
	}

	return &pb.Ingredient{
		Id:       int32(ingredient.ID),
		MealId:   int32(ingredient.MealID),
		Quantity: ingredient.Quantity,
		Unit:     ingredient.Unit,
		Name:     ingredient.Name,
	}
}

// ConvertStepToProto converts a models.Step to a protobuf Step message
func ConvertStepToProto(step *models.Step) *pb.Step {
	if step == nil {
		return nil
	}

	return &pb.Step{
		Id:          int32(step.ID),
		MealId:      int32(step.MealID),
		StepNumber:  int32(step.StepNumber),
		Instruction: step.Instruction,
	}
}

// ConvertWeeklyMealPlanToProto converts a models.WeeklyMealPlan to a protobuf WeeklyMealPlan message
func ConvertWeeklyMealPlanToProto(plan *models.WeeklyMealPlan) *pb.WeeklyMealPlan {
	if plan == nil {
		return nil
	}

	protoPlan := &pb.WeeklyMealPlan{
		Days:         make([]*pb.PlanDay, len(plan.Days)),
		ShoppingList: make([]*pb.ShoppingListItem, len(plan.ShoppingList)),
	}

	// Convert days
	for i, day := range plan.Days {
		protoPlan.Days[i] = ConvertPlanDayToProto(&day)
	}

	// Convert shopping list
	for i, item := range plan.ShoppingList {
		protoPlan.ShoppingList[i] = ConvertShoppingListItemToProto(&item)
	}

	return protoPlan
}

// ConvertPlanDayToProto converts a models.PlanDay to a protobuf PlanDay message
func ConvertPlanDayToProto(day *models.PlanDay) *pb.PlanDay {
	if day == nil {
		return nil
	}

	return &pb.PlanDay{
		Meal:     ConvertMealToProto(day.Meal),
		DayIndex: int32(day.DayIndex),
		MealType: day.MealType,
	}
}

// ConvertShoppingListItemToProto converts a models.ShoppingListItem to a protobuf ShoppingListItem message
func ConvertShoppingListItemToProto(item *models.ShoppingListItem) *pb.ShoppingListItem {
	if item == nil {
		return nil
	}

	return &pb.ShoppingListItem{
		Ingredient: item.Ingredient,
		Quantity:   item.Quantity,
		Category:   item.Category,
	}
}

// ConvertChatMessageToProto converts a models.ChatMessage to a protobuf ChatMessage message
func ConvertChatMessageToProto(message *models.ChatMessage) *pb.ChatMessage {
	if message == nil {
		return nil
	}

	protoMessage := &pb.ChatMessage{
		Id:      "", // Generate ID if needed
		Content: message.Text,
		Role:    message.Sender,
		// Note: models.ChatMessage doesn't have ThreadID, Metadata, or Timestamp
		// These may need to be passed separately or the model updated
	}

	return protoMessage
}

// ConvertWorkflowStateToProto converts a models.InternalWorkflowState to a protobuf WorkflowState message
func ConvertWorkflowStateToProto(workflow *models.InternalWorkflowState) *pb.WorkflowState {
	if workflow == nil {
		return nil
	}

	// Convert agent messages to protobuf chat messages
	protoMessages := make([]*pb.ChatMessage, len(workflow.AgentMessages))
	for i, msg := range workflow.AgentMessages {
		protoMessages[i] = &pb.ChatMessage{
			Content: msg.Text,
			Role:    msg.Sender,
		}
	}

	protoWorkflow := &pb.WorkflowState{
		ThreadId:     workflow.ThreadID,
		Status:       "active", // Default status, as InternalWorkflowState doesn't have this field
		CurrentStep:  workflow.CurrentStep,
		Messages:     protoMessages,
		Participants: workflow.Participants,
		Context:      make(map[string]string), // Convert if needed
	}

	// Convert timestamps
	if !workflow.CreatedAt.IsZero() {
		protoWorkflow.CreatedAt = timestamppb.New(workflow.CreatedAt)
	}
	if !workflow.UpdatedAt.IsZero() {
		protoWorkflow.UpdatedAt = timestamppb.New(workflow.UpdatedAt)
	}

	return protoWorkflow
}

// ConvertProtoToIngredient converts a protobuf CreateIngredientRequest to a models.Ingredient
func ConvertProtoToIngredient(protoIngredient *pb.CreateIngredientRequest) models.Ingredient {
	return models.Ingredient{
		Quantity: protoIngredient.Quantity,
		Unit:     protoIngredient.Unit,
		Name:     protoIngredient.Name,
	}
}

// ConvertProtoToMeal converts a protobuf CreateMealRequest to a models.Meal
func ConvertProtoToMeal(req *pb.CreateMealRequest) models.Meal {
	meal := models.Meal{
		MealName:       req.MealName,
		MealType:       req.MealType,
		RelativeEffort: int(req.RelativeEffort),
		RedMeat:        req.RedMeat,
		URL:            req.Url,
		Ingredients:    make([]models.Ingredient, len(req.Ingredients)),
		Steps:          make([]models.Step, len(req.Steps)),
	}

	// Convert ingredients
	for i, protoIngredient := range req.Ingredients {
		meal.Ingredients[i] = ConvertProtoToIngredient(protoIngredient)
	}

	// Convert steps (strings to Step structs)
	for i, stepInstruction := range req.Steps {
		meal.Steps[i] = models.Step{
			StepNumber:  i + 1,
			Instruction: stepInstruction,
		}
	}

	return meal
}
