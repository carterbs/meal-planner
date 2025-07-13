import type { GenFile, GenMessage, GenService } from "@bufbuild/protobuf/codegenv2";
import type { EmptySchema, Timestamp } from "@bufbuild/protobuf/wkt";
import type { Message as Message$1 } from "@bufbuild/protobuf";
/**
 * Describes the file api.proto.
 */
export declare const file_api: GenFile;
/**
 * @generated from message mealplanner.api.Ingredient
 */
export type Ingredient = Message$1<"mealplanner.api.Ingredient"> & {
    /**
     * @generated from field: int32 id = 1;
     */
    id: number;
    /**
     * @generated from field: int32 meal_id = 2;
     */
    mealId: number;
    /**
     * @generated from field: double quantity = 3;
     */
    quantity: number;
    /**
     * @generated from field: string unit = 4;
     */
    unit: string;
    /**
     * @generated from field: string name = 5;
     */
    name: string;
};
/**
 * Describes the message mealplanner.api.Ingredient.
 * Use `create(IngredientSchema)` to create a new message.
 */
export declare const IngredientSchema: GenMessage<Ingredient>;
/**
 * @generated from message mealplanner.api.Step
 */
export type Step = Message$1<"mealplanner.api.Step"> & {
    /**
     * @generated from field: int32 id = 1;
     */
    id: number;
    /**
     * @generated from field: int32 meal_id = 2;
     */
    mealId: number;
    /**
     * @generated from field: int32 step_number = 3;
     */
    stepNumber: number;
    /**
     * @generated from field: string instruction = 4;
     */
    instruction: string;
};
/**
 * Describes the message mealplanner.api.Step.
 * Use `create(StepSchema)` to create a new message.
 */
export declare const StepSchema: GenMessage<Step>;
/**
 * @generated from message mealplanner.api.Meal
 */
export type Meal = Message$1<"mealplanner.api.Meal"> & {
    /**
     * @generated from field: int32 id = 1;
     */
    id: number;
    /**
     * @generated from field: string name = 2;
     */
    name: string;
    /**
     * @generated from field: int32 effort = 3;
     */
    effort: number;
    /**
     * @generated from field: optional google.protobuf.Timestamp last_planned = 4;
     */
    lastPlanned?: Timestamp;
    /**
     * @generated from field: bool has_red_meat = 5;
     */
    hasRedMeat: boolean;
    /**
     * @generated from field: string url = 6;
     */
    url: string;
    /**
     * @generated from field: string meal_type = 7;
     */
    mealType: string;
    /**
     * @generated from field: repeated mealplanner.api.Ingredient ingredients = 8;
     */
    ingredients: Ingredient[];
    /**
     * @generated from field: repeated mealplanner.api.Step steps = 9;
     */
    steps: Step[];
};
/**
 * Describes the message mealplanner.api.Meal.
 * Use `create(MealSchema)` to create a new message.
 */
export declare const MealSchema: GenMessage<Meal>;
/**
 * @generated from message mealplanner.api.MealPlanEntry
 */
export type MealPlanEntry = Message$1<"mealplanner.api.MealPlanEntry"> & {
    /**
     * @generated from field: optional mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
    /**
     * @generated from field: int32 day_index = 2;
     */
    dayIndex: number;
    /**
     * @generated from field: string meal_type = 3;
     */
    mealType: string;
};
/**
 * Describes the message mealplanner.api.MealPlanEntry.
 * Use `create(MealPlanEntrySchema)` to create a new message.
 */
export declare const MealPlanEntrySchema: GenMessage<MealPlanEntry>;
/**
 * @generated from message mealplanner.api.ShoppingListItem
 */
export type ShoppingListItem = Message$1<"mealplanner.api.ShoppingListItem"> & {
    /**
     * @generated from field: string ingredient = 1;
     */
    ingredient: string;
    /**
     * @generated from field: string quantity = 2;
     */
    quantity: string;
    /**
     * @generated from field: string category = 3;
     */
    category: string;
};
/**
 * Describes the message mealplanner.api.ShoppingListItem.
 * Use `create(ShoppingListItemSchema)` to create a new message.
 */
export declare const ShoppingListItemSchema: GenMessage<ShoppingListItem>;
/**
 * @generated from message mealplanner.api.WeeklyMealPlan
 */
export type WeeklyMealPlan = Message$1<"mealplanner.api.WeeklyMealPlan"> & {
    /**
     * @generated from field: repeated mealplanner.api.MealPlanEntry days = 1;
     */
    days: MealPlanEntry[];
    /**
     * @generated from field: repeated mealplanner.api.ShoppingListItem shopping_list = 2;
     */
    shoppingList: ShoppingListItem[];
};
/**
 * Describes the message mealplanner.api.WeeklyMealPlan.
 * Use `create(WeeklyMealPlanSchema)` to create a new message.
 */
export declare const WeeklyMealPlanSchema: GenMessage<WeeklyMealPlan>;
/**
 * @generated from message mealplanner.api.SaveMealPlanRequest
 */
export type SaveMealPlanRequest = Message$1<"mealplanner.api.SaveMealPlanRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: int32 version = 2;
     */
    version: number;
    /**
     * @generated from field: repeated mealplanner.api.MealPlanEntry entries = 3;
     */
    entries: MealPlanEntry[];
};
/**
 * Describes the message mealplanner.api.SaveMealPlanRequest.
 * Use `create(SaveMealPlanRequestSchema)` to create a new message.
 */
export declare const SaveMealPlanRequestSchema: GenMessage<SaveMealPlanRequest>;
/**
 * @generated from message mealplanner.api.MealPlanIdentifier
 */
export type MealPlanIdentifier = Message$1<"mealplanner.api.MealPlanIdentifier"> & {
    /**
     * @generated from field: int32 id = 1;
     */
    id: number;
    /**
     * @generated from field: string thread_id = 2;
     */
    threadId: string;
    /**
     * @generated from field: int32 version = 3;
     */
    version: number;
    /**
     * @generated from field: string created_at = 4;
     */
    createdAt: string;
};
/**
 * Describes the message mealplanner.api.MealPlanIdentifier.
 * Use `create(MealPlanIdentifierSchema)` to create a new message.
 */
export declare const MealPlanIdentifierSchema: GenMessage<MealPlanIdentifier>;
/**
 * @generated from message mealplanner.api.SaveCheckpointRequest
 */
export type SaveCheckpointRequest = Message$1<"mealplanner.api.SaveCheckpointRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: int32 version = 2;
     */
    version: number;
    /**
     * @generated from field: repeated mealplanner.api.MealPlanEntry entries = 3;
     */
    entries: MealPlanEntry[];
};
/**
 * Describes the message mealplanner.api.SaveCheckpointRequest.
 * Use `create(SaveCheckpointRequestSchema)` to create a new message.
 */
export declare const SaveCheckpointRequestSchema: GenMessage<SaveCheckpointRequest>;
/**
 * @generated from message mealplanner.api.CheckpointResponse
 */
export type CheckpointResponse = Message$1<"mealplanner.api.CheckpointResponse"> & {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
};
/**
 * Describes the message mealplanner.api.CheckpointResponse.
 * Use `create(CheckpointResponseSchema)` to create a new message.
 */
export declare const CheckpointResponseSchema: GenMessage<CheckpointResponse>;
/**
 * @generated from message mealplanner.api.Message
 */
export type Message = Message$1<"mealplanner.api.Message"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * "user" or "agent"
     *
     * @generated from field: string sender = 2;
     */
    sender: string;
    /**
     * @generated from field: string content = 3;
     */
    content: string;
    /**
     * @generated from field: string created_at = 4;
     */
    createdAt: string;
};
/**
 * Describes the message mealplanner.api.Message.
 * Use `create(MessageSchema)` to create a new message.
 */
export declare const MessageSchema: GenMessage<Message>;
/**
 * @generated from message mealplanner.api.ShoppingList
 */
export type ShoppingList = Message$1<"mealplanner.api.ShoppingList"> & {
    /**
     * @generated from field: repeated mealplanner.api.ShoppingListItem items = 1;
     */
    items: ShoppingListItem[];
};
/**
 * Describes the message mealplanner.api.ShoppingList.
 * Use `create(ShoppingListSchema)` to create a new message.
 */
export declare const ShoppingListSchema: GenMessage<ShoppingList>;
/**
 * @generated from message mealplanner.api.AgentStartRequest
 */
export type AgentStartRequest = Message$1<"mealplanner.api.AgentStartRequest"> & {
    /**
     * @generated from field: repeated string participants = 1;
     */
    participants: string[];
    /**
     * @generated from field: string workflow_type = 2;
     */
    workflowType: string;
};
/**
 * Describes the message mealplanner.api.AgentStartRequest.
 * Use `create(AgentStartRequestSchema)` to create a new message.
 */
export declare const AgentStartRequestSchema: GenMessage<AgentStartRequest>;
/**
 * @generated from message mealplanner.api.AgentFeedbackRequest
 */
export type AgentFeedbackRequest = Message$1<"mealplanner.api.AgentFeedbackRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    /**
     * @generated from field: string from = 3;
     */
    from: string;
};
/**
 * Describes the message mealplanner.api.AgentFeedbackRequest.
 * Use `create(AgentFeedbackRequestSchema)` to create a new message.
 */
export declare const AgentFeedbackRequestSchema: GenMessage<AgentFeedbackRequest>;
/**
 * @generated from message mealplanner.api.AgentResumeRequest
 */
export type AgentResumeRequest = Message$1<"mealplanner.api.AgentResumeRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: bool interactive = 2;
     */
    interactive: boolean;
};
/**
 * Describes the message mealplanner.api.AgentResumeRequest.
 * Use `create(AgentResumeRequestSchema)` to create a new message.
 */
export declare const AgentResumeRequestSchema: GenMessage<AgentResumeRequest>;
/**
 * @generated from message mealplanner.api.AgentMessageRequest
 */
export type AgentMessageRequest = Message$1<"mealplanner.api.AgentMessageRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    /**
     * @generated from field: string from = 3;
     */
    from: string;
    /**
     * @generated from field: bool interactive = 4;
     */
    interactive: boolean;
};
/**
 * Describes the message mealplanner.api.AgentMessageRequest.
 * Use `create(AgentMessageRequestSchema)` to create a new message.
 */
export declare const AgentMessageRequestSchema: GenMessage<AgentMessageRequest>;
/**
 * @generated from message mealplanner.api.AgentResponse
 */
export type AgentResponse = Message$1<"mealplanner.api.AgentResponse"> & {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    /**
     * @generated from field: string thread_id = 3;
     */
    threadId: string;
    /**
     * @generated from field: string current_step = 4;
     */
    currentStep: string;
    /**
     * JSON string
     *
     * @generated from field: string initial_state = 5;
     */
    initialState: string;
    /**
     * JSON string
     *
     * @generated from field: string raw = 6;
     */
    raw: string;
};
/**
 * Describes the message mealplanner.api.AgentResponse.
 * Use `create(AgentResponseSchema)` to create a new message.
 */
export declare const AgentResponseSchema: GenMessage<AgentResponse>;
/**
 * @generated from message mealplanner.api.WorkflowStatus
 */
export type WorkflowStatus = Message$1<"mealplanner.api.WorkflowStatus"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: string workflow_type = 2;
     */
    workflowType: string;
    /**
     * @generated from field: string current_step = 3;
     */
    currentStep: string;
    /**
     * @generated from field: repeated string participants = 4;
     */
    participants: string[];
};
/**
 * Describes the message mealplanner.api.WorkflowStatus.
 * Use `create(WorkflowStatusSchema)` to create a new message.
 */
export declare const WorkflowStatusSchema: GenMessage<WorkflowStatus>;
/**
 * Health endpoints
 *
 * @generated from message mealplanner.api.HealthCheckResponse
 */
export type HealthCheckResponse = Message$1<"mealplanner.api.HealthCheckResponse"> & {
    /**
     * @generated from field: string status = 1;
     */
    status: string;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.HealthCheckResponse.
 * Use `create(HealthCheckResponseSchema)` to create a new message.
 */
export declare const HealthCheckResponseSchema: GenMessage<HealthCheckResponse>;
/**
 * @generated from message mealplanner.api.ReconnectResponse
 */
export type ReconnectResponse = Message$1<"mealplanner.api.ReconnectResponse"> & {
    /**
     * @generated from field: string status = 1;
     */
    status: string;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.ReconnectResponse.
 * Use `create(ReconnectResponseSchema)` to create a new message.
 */
export declare const ReconnectResponseSchema: GenMessage<ReconnectResponse>;
/**
 * Meal plan endpoints
 *
 * @generated from message mealplanner.api.GetMealPlanResponse
 */
export type GetMealPlanResponse = Message$1<"mealplanner.api.GetMealPlanResponse"> & {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
};
/**
 * Describes the message mealplanner.api.GetMealPlanResponse.
 * Use `create(GetMealPlanResponseSchema)` to create a new message.
 */
export declare const GetMealPlanResponseSchema: GenMessage<GetMealPlanResponse>;
/**
 * @generated from message mealplanner.api.GenerateMealPlanResponse
 */
export type GenerateMealPlanResponse = Message$1<"mealplanner.api.GenerateMealPlanResponse"> & {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
};
/**
 * Describes the message mealplanner.api.GenerateMealPlanResponse.
 * Use `create(GenerateMealPlanResponseSchema)` to create a new message.
 */
export declare const GenerateMealPlanResponseSchema: GenMessage<GenerateMealPlanResponse>;
/**
 * @generated from message mealplanner.api.FinalizeMealPlanRequest
 */
export type FinalizeMealPlanRequest = Message$1<"mealplanner.api.FinalizeMealPlanRequest"> & {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
};
/**
 * Describes the message mealplanner.api.FinalizeMealPlanRequest.
 * Use `create(FinalizeMealPlanRequestSchema)` to create a new message.
 */
export declare const FinalizeMealPlanRequestSchema: GenMessage<FinalizeMealPlanRequest>;
/**
 * @generated from message mealplanner.api.FinalizeMealPlanResponse
 */
export type FinalizeMealPlanResponse = Message$1<"mealplanner.api.FinalizeMealPlanResponse"> & {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.FinalizeMealPlanResponse.
 * Use `create(FinalizeMealPlanResponseSchema)` to create a new message.
 */
export declare const FinalizeMealPlanResponseSchema: GenMessage<FinalizeMealPlanResponse>;
/**
 * @generated from message mealplanner.api.MealPlanICSResponse
 */
export type MealPlanICSResponse = Message$1<"mealplanner.api.MealPlanICSResponse"> & {
    /**
     * @generated from field: bytes ics_data = 1;
     */
    icsData: Uint8Array;
};
/**
 * Describes the message mealplanner.api.MealPlanICSResponse.
 * Use `create(MealPlanICSResponseSchema)` to create a new message.
 */
export declare const MealPlanICSResponseSchema: GenMessage<MealPlanICSResponse>;
/**
 * Shopping list endpoints
 *
 * @generated from message mealplanner.api.GetShoppingListRequest
 */
export type GetShoppingListRequest = Message$1<"mealplanner.api.GetShoppingListRequest"> & {
    /**
     * meal IDs
     *
     * @generated from field: repeated int32 plan = 1;
     */
    plan: number[];
};
/**
 * Describes the message mealplanner.api.GetShoppingListRequest.
 * Use `create(GetShoppingListRequestSchema)` to create a new message.
 */
export declare const GetShoppingListRequestSchema: GenMessage<GetShoppingListRequest>;
/**
 * @generated from message mealplanner.api.GetShoppingListResponse
 */
export type GetShoppingListResponse = Message$1<"mealplanner.api.GetShoppingListResponse"> & {
    /**
     * @generated from field: repeated mealplanner.api.ShoppingListItem items = 1;
     */
    items: ShoppingListItem[];
};
/**
 * Describes the message mealplanner.api.GetShoppingListResponse.
 * Use `create(GetShoppingListResponseSchema)` to create a new message.
 */
export declare const GetShoppingListResponseSchema: GenMessage<GetShoppingListResponse>;
/**
 * Meals endpoints
 *
 * @generated from message mealplanner.api.GetAllMealsRequest
 */
export type GetAllMealsRequest = Message$1<"mealplanner.api.GetAllMealsRequest"> & {
    /**
     * optional filter by meal type
     *
     * @generated from field: string type = 1;
     */
    type: string;
};
/**
 * Describes the message mealplanner.api.GetAllMealsRequest.
 * Use `create(GetAllMealsRequestSchema)` to create a new message.
 */
export declare const GetAllMealsRequestSchema: GenMessage<GetAllMealsRequest>;
/**
 * @generated from message mealplanner.api.GetAllMealsResponse
 */
export type GetAllMealsResponse = Message$1<"mealplanner.api.GetAllMealsResponse"> & {
    /**
     * @generated from field: repeated mealplanner.api.Meal meals = 1;
     */
    meals: Meal[];
};
/**
 * Describes the message mealplanner.api.GetAllMealsResponse.
 * Use `create(GetAllMealsResponseSchema)` to create a new message.
 */
export declare const GetAllMealsResponseSchema: GenMessage<GetAllMealsResponse>;
/**
 * @generated from message mealplanner.api.CreateMealRequest
 */
export type CreateMealRequest = Message$1<"mealplanner.api.CreateMealRequest"> & {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
};
/**
 * Describes the message mealplanner.api.CreateMealRequest.
 * Use `create(CreateMealRequestSchema)` to create a new message.
 */
export declare const CreateMealRequestSchema: GenMessage<CreateMealRequest>;
/**
 * @generated from message mealplanner.api.CreateMealResponse
 */
export type CreateMealResponse = Message$1<"mealplanner.api.CreateMealResponse"> & {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
};
/**
 * Describes the message mealplanner.api.CreateMealResponse.
 * Use `create(CreateMealResponseSchema)` to create a new message.
 */
export declare const CreateMealResponseSchema: GenMessage<CreateMealResponse>;
/**
 * @generated from message mealplanner.api.SwapMealRequest
 */
export type SwapMealRequest = Message$1<"mealplanner.api.SwapMealRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: string meal_type = 2;
     */
    mealType: string;
};
/**
 * Describes the message mealplanner.api.SwapMealRequest.
 * Use `create(SwapMealRequestSchema)` to create a new message.
 */
export declare const SwapMealRequestSchema: GenMessage<SwapMealRequest>;
/**
 * @generated from message mealplanner.api.SwapMealResponse
 */
export type SwapMealResponse = Message$1<"mealplanner.api.SwapMealResponse"> & {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
};
/**
 * Describes the message mealplanner.api.SwapMealResponse.
 * Use `create(SwapMealResponseSchema)` to create a new message.
 */
export declare const SwapMealResponseSchema: GenMessage<SwapMealResponse>;
/**
 * @generated from message mealplanner.api.RemoveMealRequest
 */
export type RemoveMealRequest = Message$1<"mealplanner.api.RemoveMealRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: int32 day_index = 2;
     */
    dayIndex: number;
    /**
     * @generated from field: string meal_type = 3;
     */
    mealType: string;
};
/**
 * Describes the message mealplanner.api.RemoveMealRequest.
 * Use `create(RemoveMealRequestSchema)` to create a new message.
 */
export declare const RemoveMealRequestSchema: GenMessage<RemoveMealRequest>;
/**
 * @generated from message mealplanner.api.RemoveMealResponse
 */
export type RemoveMealResponse = Message$1<"mealplanner.api.RemoveMealResponse"> & {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
};
/**
 * Describes the message mealplanner.api.RemoveMealResponse.
 * Use `create(RemoveMealResponseSchema)` to create a new message.
 */
export declare const RemoveMealResponseSchema: GenMessage<RemoveMealResponse>;
/**
 * @generated from message mealplanner.api.ReplaceMealRequest
 */
export type ReplaceMealRequest = Message$1<"mealplanner.api.ReplaceMealRequest"> & {
    /**
     * @generated from field: string day = 1;
     */
    day: string;
    /**
     * @generated from field: int32 new_meal_id = 2;
     */
    newMealId: number;
};
/**
 * Describes the message mealplanner.api.ReplaceMealRequest.
 * Use `create(ReplaceMealRequestSchema)` to create a new message.
 */
export declare const ReplaceMealRequestSchema: GenMessage<ReplaceMealRequest>;
/**
 * @generated from message mealplanner.api.ReplaceMealResponse
 */
export type ReplaceMealResponse = Message$1<"mealplanner.api.ReplaceMealResponse"> & {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
};
/**
 * Describes the message mealplanner.api.ReplaceMealResponse.
 * Use `create(ReplaceMealResponseSchema)` to create a new message.
 */
export declare const ReplaceMealResponseSchema: GenMessage<ReplaceMealResponse>;
/**
 * @generated from message mealplanner.api.UpdateMealIngredientRequest
 */
export type UpdateMealIngredientRequest = Message$1<"mealplanner.api.UpdateMealIngredientRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: int32 ingredient_id = 2;
     */
    ingredientId: number;
    /**
     * @generated from field: mealplanner.api.Ingredient ingredient = 3;
     */
    ingredient?: Ingredient;
};
/**
 * Describes the message mealplanner.api.UpdateMealIngredientRequest.
 * Use `create(UpdateMealIngredientRequestSchema)` to create a new message.
 */
export declare const UpdateMealIngredientRequestSchema: GenMessage<UpdateMealIngredientRequest>;
/**
 * @generated from message mealplanner.api.UpdateMealIngredientResponse
 */
export type UpdateMealIngredientResponse = Message$1<"mealplanner.api.UpdateMealIngredientResponse"> & {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
};
/**
 * Describes the message mealplanner.api.UpdateMealIngredientResponse.
 * Use `create(UpdateMealIngredientResponseSchema)` to create a new message.
 */
export declare const UpdateMealIngredientResponseSchema: GenMessage<UpdateMealIngredientResponse>;
/**
 * @generated from message mealplanner.api.DeleteMealIngredientRequest
 */
export type DeleteMealIngredientRequest = Message$1<"mealplanner.api.DeleteMealIngredientRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: int32 ingredient_id = 2;
     */
    ingredientId: number;
};
/**
 * Describes the message mealplanner.api.DeleteMealIngredientRequest.
 * Use `create(DeleteMealIngredientRequestSchema)` to create a new message.
 */
export declare const DeleteMealIngredientRequestSchema: GenMessage<DeleteMealIngredientRequest>;
/**
 * @generated from message mealplanner.api.DeleteMealIngredientResponse
 */
export type DeleteMealIngredientResponse = Message$1<"mealplanner.api.DeleteMealIngredientResponse"> & {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
};
/**
 * Describes the message mealplanner.api.DeleteMealIngredientResponse.
 * Use `create(DeleteMealIngredientResponseSchema)` to create a new message.
 */
export declare const DeleteMealIngredientResponseSchema: GenMessage<DeleteMealIngredientResponse>;
/**
 * @generated from message mealplanner.api.DeleteMealRequest
 */
export type DeleteMealRequest = Message$1<"mealplanner.api.DeleteMealRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
};
/**
 * Describes the message mealplanner.api.DeleteMealRequest.
 * Use `create(DeleteMealRequestSchema)` to create a new message.
 */
export declare const DeleteMealRequestSchema: GenMessage<DeleteMealRequest>;
/**
 * @generated from message mealplanner.api.DeleteMealResponse
 */
export type DeleteMealResponse = Message$1<"mealplanner.api.DeleteMealResponse"> & {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.DeleteMealResponse.
 * Use `create(DeleteMealResponseSchema)` to create a new message.
 */
export declare const DeleteMealResponseSchema: GenMessage<DeleteMealResponse>;
/**
 * Recipe steps endpoints
 *
 * @generated from message mealplanner.api.GetStepsRequest
 */
export type GetStepsRequest = Message$1<"mealplanner.api.GetStepsRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
};
/**
 * Describes the message mealplanner.api.GetStepsRequest.
 * Use `create(GetStepsRequestSchema)` to create a new message.
 */
export declare const GetStepsRequestSchema: GenMessage<GetStepsRequest>;
/**
 * @generated from message mealplanner.api.GetStepsResponse
 */
export type GetStepsResponse = Message$1<"mealplanner.api.GetStepsResponse"> & {
    /**
     * @generated from field: repeated mealplanner.api.Step steps = 1;
     */
    steps: Step[];
};
/**
 * Describes the message mealplanner.api.GetStepsResponse.
 * Use `create(GetStepsResponseSchema)` to create a new message.
 */
export declare const GetStepsResponseSchema: GenMessage<GetStepsResponse>;
/**
 * @generated from message mealplanner.api.AddStepRequest
 */
export type AddStepRequest = Message$1<"mealplanner.api.AddStepRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: mealplanner.api.Step step = 2;
     */
    step?: Step;
};
/**
 * Describes the message mealplanner.api.AddStepRequest.
 * Use `create(AddStepRequestSchema)` to create a new message.
 */
export declare const AddStepRequestSchema: GenMessage<AddStepRequest>;
/**
 * @generated from message mealplanner.api.AddStepResponse
 */
export type AddStepResponse = Message$1<"mealplanner.api.AddStepResponse"> & {
    /**
     * @generated from field: mealplanner.api.Step step = 1;
     */
    step?: Step;
};
/**
 * Describes the message mealplanner.api.AddStepResponse.
 * Use `create(AddStepResponseSchema)` to create a new message.
 */
export declare const AddStepResponseSchema: GenMessage<AddStepResponse>;
/**
 * @generated from message mealplanner.api.AddBulkStepsRequest
 */
export type AddBulkStepsRequest = Message$1<"mealplanner.api.AddBulkStepsRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: repeated string instructions = 2;
     */
    instructions: string[];
};
/**
 * Describes the message mealplanner.api.AddBulkStepsRequest.
 * Use `create(AddBulkStepsRequestSchema)` to create a new message.
 */
export declare const AddBulkStepsRequestSchema: GenMessage<AddBulkStepsRequest>;
/**
 * @generated from message mealplanner.api.AddBulkStepsResponse
 */
export type AddBulkStepsResponse = Message$1<"mealplanner.api.AddBulkStepsResponse"> & {
    /**
     * @generated from field: repeated mealplanner.api.Step steps = 1;
     */
    steps: Step[];
};
/**
 * Describes the message mealplanner.api.AddBulkStepsResponse.
 * Use `create(AddBulkStepsResponseSchema)` to create a new message.
 */
export declare const AddBulkStepsResponseSchema: GenMessage<AddBulkStepsResponse>;
/**
 * @generated from message mealplanner.api.UpdateStepRequest
 */
export type UpdateStepRequest = Message$1<"mealplanner.api.UpdateStepRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: int32 step_id = 2;
     */
    stepId: number;
    /**
     * @generated from field: mealplanner.api.Step step = 3;
     */
    step?: Step;
};
/**
 * Describes the message mealplanner.api.UpdateStepRequest.
 * Use `create(UpdateStepRequestSchema)` to create a new message.
 */
export declare const UpdateStepRequestSchema: GenMessage<UpdateStepRequest>;
/**
 * @generated from message mealplanner.api.UpdateStepResponse
 */
export type UpdateStepResponse = Message$1<"mealplanner.api.UpdateStepResponse"> & {
    /**
     * @generated from field: mealplanner.api.Step step = 1;
     */
    step?: Step;
};
/**
 * Describes the message mealplanner.api.UpdateStepResponse.
 * Use `create(UpdateStepResponseSchema)` to create a new message.
 */
export declare const UpdateStepResponseSchema: GenMessage<UpdateStepResponse>;
/**
 * @generated from message mealplanner.api.DeleteStepRequest
 */
export type DeleteStepRequest = Message$1<"mealplanner.api.DeleteStepRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: int32 step_id = 2;
     */
    stepId: number;
};
/**
 * Describes the message mealplanner.api.DeleteStepRequest.
 * Use `create(DeleteStepRequestSchema)` to create a new message.
 */
export declare const DeleteStepRequestSchema: GenMessage<DeleteStepRequest>;
/**
 * @generated from message mealplanner.api.DeleteStepResponse
 */
export type DeleteStepResponse = Message$1<"mealplanner.api.DeleteStepResponse"> & {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.DeleteStepResponse.
 * Use `create(DeleteStepResponseSchema)` to create a new message.
 */
export declare const DeleteStepResponseSchema: GenMessage<DeleteStepResponse>;
/**
 * @generated from message mealplanner.api.ReorderStepsRequest
 */
export type ReorderStepsRequest = Message$1<"mealplanner.api.ReorderStepsRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: repeated int32 step_ids = 2;
     */
    stepIds: number[];
};
/**
 * Describes the message mealplanner.api.ReorderStepsRequest.
 * Use `create(ReorderStepsRequestSchema)` to create a new message.
 */
export declare const ReorderStepsRequestSchema: GenMessage<ReorderStepsRequest>;
/**
 * @generated from message mealplanner.api.ReorderStepsResponse
 */
export type ReorderStepsResponse = Message$1<"mealplanner.api.ReorderStepsResponse"> & {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.ReorderStepsResponse.
 * Use `create(ReorderStepsResponseSchema)` to create a new message.
 */
export declare const ReorderStepsResponseSchema: GenMessage<ReorderStepsResponse>;
/**
 * @generated from message mealplanner.api.DeleteAllStepsRequest
 */
export type DeleteAllStepsRequest = Message$1<"mealplanner.api.DeleteAllStepsRequest"> & {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
};
/**
 * Describes the message mealplanner.api.DeleteAllStepsRequest.
 * Use `create(DeleteAllStepsRequestSchema)` to create a new message.
 */
export declare const DeleteAllStepsRequestSchema: GenMessage<DeleteAllStepsRequest>;
/**
 * @generated from message mealplanner.api.DeleteAllStepsResponse
 */
export type DeleteAllStepsResponse = Message$1<"mealplanner.api.DeleteAllStepsResponse"> & {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.DeleteAllStepsResponse.
 * Use `create(DeleteAllStepsResponseSchema)` to create a new message.
 */
export declare const DeleteAllStepsResponseSchema: GenMessage<DeleteAllStepsResponse>;
/**
 * Agent workflow endpoints
 *
 * @generated from message mealplanner.api.StartAgentWorkflowRequest
 */
export type StartAgentWorkflowRequest = Message$1<"mealplanner.api.StartAgentWorkflowRequest"> & {
    /**
     * @generated from field: mealplanner.api.AgentStartRequest request = 1;
     */
    request?: AgentStartRequest;
};
/**
 * Describes the message mealplanner.api.StartAgentWorkflowRequest.
 * Use `create(StartAgentWorkflowRequestSchema)` to create a new message.
 */
export declare const StartAgentWorkflowRequestSchema: GenMessage<StartAgentWorkflowRequest>;
/**
 * @generated from message mealplanner.api.StartAgentWorkflowResponse
 */
export type StartAgentWorkflowResponse = Message$1<"mealplanner.api.StartAgentWorkflowResponse"> & {
    /**
     * @generated from field: mealplanner.api.AgentResponse response = 1;
     */
    response?: AgentResponse;
};
/**
 * Describes the message mealplanner.api.StartAgentWorkflowResponse.
 * Use `create(StartAgentWorkflowResponseSchema)` to create a new message.
 */
export declare const StartAgentWorkflowResponseSchema: GenMessage<StartAgentWorkflowResponse>;
/**
 * @generated from message mealplanner.api.MessageAgentRequest
 */
export type MessageAgentRequest = Message$1<"mealplanner.api.MessageAgentRequest"> & {
    /**
     * @generated from field: mealplanner.api.AgentMessageRequest request = 1;
     */
    request?: AgentMessageRequest;
};
/**
 * Describes the message mealplanner.api.MessageAgentRequest.
 * Use `create(MessageAgentRequestSchema)` to create a new message.
 */
export declare const MessageAgentRequestSchema: GenMessage<MessageAgentRequest>;
/**
 * @generated from message mealplanner.api.MessageAgentResponse
 */
export type MessageAgentResponse = Message$1<"mealplanner.api.MessageAgentResponse"> & {
    /**
     * @generated from field: mealplanner.api.AgentResponse response = 1;
     */
    response?: AgentResponse;
};
/**
 * Describes the message mealplanner.api.MessageAgentResponse.
 * Use `create(MessageAgentResponseSchema)` to create a new message.
 */
export declare const MessageAgentResponseSchema: GenMessage<MessageAgentResponse>;
/**
 * @generated from message mealplanner.api.GetWorkflowStatusRequest
 */
export type GetWorkflowStatusRequest = Message$1<"mealplanner.api.GetWorkflowStatusRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
};
/**
 * Describes the message mealplanner.api.GetWorkflowStatusRequest.
 * Use `create(GetWorkflowStatusRequestSchema)` to create a new message.
 */
export declare const GetWorkflowStatusRequestSchema: GenMessage<GetWorkflowStatusRequest>;
/**
 * @generated from message mealplanner.api.GetWorkflowStatusResponse
 */
export type GetWorkflowStatusResponse = Message$1<"mealplanner.api.GetWorkflowStatusResponse"> & {
    /**
     * @generated from field: mealplanner.api.WorkflowStatus status = 1;
     */
    status?: WorkflowStatus;
};
/**
 * Describes the message mealplanner.api.GetWorkflowStatusResponse.
 * Use `create(GetWorkflowStatusResponseSchema)` to create a new message.
 */
export declare const GetWorkflowStatusResponseSchema: GenMessage<GetWorkflowStatusResponse>;
/**
 * @generated from message mealplanner.api.ListWorkflowsResponse
 */
export type ListWorkflowsResponse = Message$1<"mealplanner.api.ListWorkflowsResponse"> & {
    /**
     * @generated from field: repeated mealplanner.api.WorkflowStatus workflows = 1;
     */
    workflows: WorkflowStatus[];
};
/**
 * Describes the message mealplanner.api.ListWorkflowsResponse.
 * Use `create(ListWorkflowsResponseSchema)` to create a new message.
 */
export declare const ListWorkflowsResponseSchema: GenMessage<ListWorkflowsResponse>;
/**
 * @generated from message mealplanner.api.CancelWorkflowRequest
 */
export type CancelWorkflowRequest = Message$1<"mealplanner.api.CancelWorkflowRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
};
/**
 * Describes the message mealplanner.api.CancelWorkflowRequest.
 * Use `create(CancelWorkflowRequestSchema)` to create a new message.
 */
export declare const CancelWorkflowRequestSchema: GenMessage<CancelWorkflowRequest>;
/**
 * @generated from message mealplanner.api.CancelWorkflowResponse
 */
export type CancelWorkflowResponse = Message$1<"mealplanner.api.CancelWorkflowResponse"> & {
    /**
     * @generated from field: string status = 1;
     */
    status: string;
};
/**
 * Describes the message mealplanner.api.CancelWorkflowResponse.
 * Use `create(CancelWorkflowResponseSchema)` to create a new message.
 */
export declare const CancelWorkflowResponseSchema: GenMessage<CancelWorkflowResponse>;
/**
 * Workflow management endpoints
 *
 * @generated from message mealplanner.api.GetWorkflowStateRequest
 */
export type GetWorkflowStateRequest = Message$1<"mealplanner.api.GetWorkflowStateRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
};
/**
 * Describes the message mealplanner.api.GetWorkflowStateRequest.
 * Use `create(GetWorkflowStateRequestSchema)` to create a new message.
 */
export declare const GetWorkflowStateRequestSchema: GenMessage<GetWorkflowStateRequest>;
/**
 * @generated from message mealplanner.api.GetWorkflowStateResponse
 */
export type GetWorkflowStateResponse = Message$1<"mealplanner.api.GetWorkflowStateResponse"> & {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
    /**
     * @generated from field: mealplanner.api.ShoppingList shopping_list = 2;
     */
    shoppingList?: ShoppingList;
    /**
     * @generated from field: repeated mealplanner.api.Message messages = 3;
     */
    messages: Message[];
};
/**
 * Describes the message mealplanner.api.GetWorkflowStateResponse.
 * Use `create(GetWorkflowStateResponseSchema)` to create a new message.
 */
export declare const GetWorkflowStateResponseSchema: GenMessage<GetWorkflowStateResponse>;
/**
 * @generated from message mealplanner.api.AbandonWorkflowRequest
 */
export type AbandonWorkflowRequest = Message$1<"mealplanner.api.AbandonWorkflowRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
};
/**
 * Describes the message mealplanner.api.AbandonWorkflowRequest.
 * Use `create(AbandonWorkflowRequestSchema)` to create a new message.
 */
export declare const AbandonWorkflowRequestSchema: GenMessage<AbandonWorkflowRequest>;
/**
 * @generated from message mealplanner.api.AbandonWorkflowResponse
 */
export type AbandonWorkflowResponse = Message$1<"mealplanner.api.AbandonWorkflowResponse"> & {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.AbandonWorkflowResponse.
 * Use `create(AbandonWorkflowResponseSchema)` to create a new message.
 */
export declare const AbandonWorkflowResponseSchema: GenMessage<AbandonWorkflowResponse>;
/**
 * @generated from message mealplanner.api.AddMessageRequest
 */
export type AddMessageRequest = Message$1<"mealplanner.api.AddMessageRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * "user" or "agent"
     *
     * @generated from field: string sender = 2;
     */
    sender: string;
    /**
     * @generated from field: string message = 3;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.AddMessageRequest.
 * Use `create(AddMessageRequestSchema)` to create a new message.
 */
export declare const AddMessageRequestSchema: GenMessage<AddMessageRequest>;
/**
 * @generated from message mealplanner.api.AddMessageResponse
 */
export type AddMessageResponse = Message$1<"mealplanner.api.AddMessageResponse"> & {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.AddMessageResponse.
 * Use `create(AddMessageResponseSchema)` to create a new message.
 */
export declare const AddMessageResponseSchema: GenMessage<AddMessageResponse>;
/**
 * @generated from message mealplanner.api.UpdateSessionStateRequest
 */
export type UpdateSessionStateRequest = Message$1<"mealplanner.api.UpdateSessionStateRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * JSON string
     *
     * @generated from field: string meal_plan = 2;
     */
    mealPlan: string;
    /**
     * JSON string
     *
     * @generated from field: string shopping_list = 3;
     */
    shoppingList: string;
    /**
     * @generated from field: string current_step = 4;
     */
    currentStep: string;
    /**
     * @generated from field: string status = 5;
     */
    status: string;
};
/**
 * Describes the message mealplanner.api.UpdateSessionStateRequest.
 * Use `create(UpdateSessionStateRequestSchema)` to create a new message.
 */
export declare const UpdateSessionStateRequestSchema: GenMessage<UpdateSessionStateRequest>;
/**
 * @generated from message mealplanner.api.UpdateSessionStateResponse
 */
export type UpdateSessionStateResponse = Message$1<"mealplanner.api.UpdateSessionStateResponse"> & {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.UpdateSessionStateResponse.
 * Use `create(UpdateSessionStateResponseSchema)` to create a new message.
 */
export declare const UpdateSessionStateResponseSchema: GenMessage<UpdateSessionStateResponse>;
/**
 * Feedback entry reused inside MealPlanningState and checkpoints
 *
 * @generated from message mealplanner.api.FeedbackEntryProto
 */
export type FeedbackEntryProto = Message$1<"mealplanner.api.FeedbackEntryProto"> & {
    /**
     * "user" or agent id
     *
     * @generated from field: string from = 1;
     */
    from: string;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    /**
     * @generated from field: google.protobuf.Timestamp timestamp = 3;
     */
    timestamp?: Timestamp;
    /**
     * @generated from field: int32 meal_plan_version = 4;
     */
    mealPlanVersion: number;
};
/**
 * Describes the message mealplanner.api.FeedbackEntryProto.
 * Use `create(FeedbackEntryProtoSchema)` to create a new message.
 */
export declare const FeedbackEntryProtoSchema: GenMessage<FeedbackEntryProto>;
/**
 * Strictly-typed state for the meal-planning workflow
 *
 * @generated from message mealplanner.api.MealPlanningCheckpointState
 */
export type MealPlanningCheckpointState = Message$1<"mealplanner.api.MealPlanningCheckpointState"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: repeated string participants = 2;
     */
    participants: string[];
    /**
     * @generated from field: google.protobuf.Timestamp created_at = 3;
     */
    createdAt?: Timestamp;
    /**
     * @generated from field: google.protobuf.Timestamp updated_at = 4;
     */
    updatedAt?: Timestamp;
    /**
     * @generated from field: string current_step = 5;
     */
    currentStep: string;
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan meal_plan = 6;
     */
    mealPlan?: WeeklyMealPlan;
    /**
     * @generated from field: repeated mealplanner.api.FeedbackEntryProto feedback_history = 7;
     */
    feedbackHistory: FeedbackEntryProto[];
    /**
     * @generated from field: int32 iteration_count = 8;
     */
    iterationCount: number;
    /**
     * @generated from field: mealplanner.api.ShoppingList shopping_list = 9;
     */
    shoppingList?: ShoppingList;
    /**
     * @generated from field: bool is_finalized = 10;
     */
    isFinalized: boolean;
};
/**
 * Describes the message mealplanner.api.MealPlanningCheckpointState.
 * Use `create(MealPlanningCheckpointStateSchema)` to create a new message.
 */
export declare const MealPlanningCheckpointStateSchema: GenMessage<MealPlanningCheckpointState>;
/**
 * LangGraph checkpoint persistence (strict)
 *
 * @generated from message mealplanner.api.AgentCheckpoint
 */
export type AgentCheckpoint = Message$1<"mealplanner.api.AgentCheckpoint"> & {
    /**
     * @generated from field: mealplanner.api.MealPlanningCheckpointState state = 1;
     */
    state?: MealPlanningCheckpointState;
    /**
     * @generated from field: repeated mealplanner.api.Message messages = 2;
     */
    messages: Message[];
    /**
     * @generated from field: repeated string next = 3;
     */
    next: string[];
    /**
     * @generated from field: int32 step = 4;
     */
    step: number;
};
/**
 * Describes the message mealplanner.api.AgentCheckpoint.
 * Use `create(AgentCheckpointSchema)` to create a new message.
 */
export declare const AgentCheckpointSchema: GenMessage<AgentCheckpoint>;
/**
 * @generated from message mealplanner.api.AgentCheckpointMetadata
 */
export type AgentCheckpointMetadata = Message$1<"mealplanner.api.AgentCheckpointMetadata"> & {
    /**
     * @generated from field: string source = 1;
     */
    source: string;
    /**
     * @generated from field: int32 step = 2;
     */
    step: number;
};
/**
 * Describes the message mealplanner.api.AgentCheckpointMetadata.
 * Use `create(AgentCheckpointMetadataSchema)` to create a new message.
 */
export declare const AgentCheckpointMetadataSchema: GenMessage<AgentCheckpointMetadata>;
/**
 * @generated from message mealplanner.api.CheckpointTuple
 */
export type CheckpointTuple = Message$1<"mealplanner.api.CheckpointTuple"> & {
    /**
     * @generated from field: mealplanner.api.AgentCheckpoint checkpoint = 1;
     */
    checkpoint?: AgentCheckpoint;
    /**
     * @generated from field: mealplanner.api.AgentCheckpointMetadata metadata = 2;
     */
    metadata?: AgentCheckpointMetadata;
};
/**
 * Describes the message mealplanner.api.CheckpointTuple.
 * Use `create(CheckpointTupleSchema)` to create a new message.
 */
export declare const CheckpointTupleSchema: GenMessage<CheckpointTuple>;
/**
 * @generated from message mealplanner.api.GetCheckpointRequest
 */
export type GetCheckpointRequest = Message$1<"mealplanner.api.GetCheckpointRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * optional - if empty, fetch latest
     *
     * @generated from field: string checkpoint_ns = 2;
     */
    checkpointNs: string;
};
/**
 * Describes the message mealplanner.api.GetCheckpointRequest.
 * Use `create(GetCheckpointRequestSchema)` to create a new message.
 */
export declare const GetCheckpointRequestSchema: GenMessage<GetCheckpointRequest>;
/**
 * @generated from message mealplanner.api.GetCheckpointResponse
 */
export type GetCheckpointResponse = Message$1<"mealplanner.api.GetCheckpointResponse"> & {
    /**
     * @generated from field: mealplanner.api.CheckpointTuple tuple = 1;
     */
    tuple?: CheckpointTuple;
    /**
     * @generated from field: bool found = 2;
     */
    found: boolean;
};
/**
 * Describes the message mealplanner.api.GetCheckpointResponse.
 * Use `create(GetCheckpointResponseSchema)` to create a new message.
 */
export declare const GetCheckpointResponseSchema: GenMessage<GetCheckpointResponse>;
/**
 * @generated from message mealplanner.api.PutCheckpointRequest
 */
export type PutCheckpointRequest = Message$1<"mealplanner.api.PutCheckpointRequest"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: string checkpoint_ns = 2;
     */
    checkpointNs: string;
    /**
     * @generated from field: string workflow_type = 3;
     */
    workflowType: string;
    /**
     * @generated from field: mealplanner.api.AgentCheckpoint checkpoint = 4;
     */
    checkpoint?: AgentCheckpoint;
    /**
     * @generated from field: mealplanner.api.AgentCheckpointMetadata metadata = 5;
     */
    metadata?: AgentCheckpointMetadata;
};
/**
 * Describes the message mealplanner.api.PutCheckpointRequest.
 * Use `create(PutCheckpointRequestSchema)` to create a new message.
 */
export declare const PutCheckpointRequestSchema: GenMessage<PutCheckpointRequest>;
/**
 * @generated from message mealplanner.api.PutCheckpointResponse
 */
export type PutCheckpointResponse = Message$1<"mealplanner.api.PutCheckpointResponse"> & {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: string thread_id = 2;
     */
    threadId: string;
    /**
     * @generated from field: string checkpoint_ns = 3;
     */
    checkpointNs: string;
};
/**
 * Describes the message mealplanner.api.PutCheckpointResponse.
 * Use `create(PutCheckpointResponseSchema)` to create a new message.
 */
export declare const PutCheckpointResponseSchema: GenMessage<PutCheckpointResponse>;
/**
 * @generated from message mealplanner.api.ListCheckpointsRequest
 */
export type ListCheckpointsRequest = Message$1<"mealplanner.api.ListCheckpointsRequest"> & {
    /**
     * @generated from field: int32 limit = 1;
     */
    limit: number;
    /**
     * optional pagination
     *
     * @generated from field: string before_thread_id = 2;
     */
    beforeThreadId: string;
};
/**
 * Describes the message mealplanner.api.ListCheckpointsRequest.
 * Use `create(ListCheckpointsRequestSchema)` to create a new message.
 */
export declare const ListCheckpointsRequestSchema: GenMessage<ListCheckpointsRequest>;
/**
 * @generated from message mealplanner.api.ListCheckpointsResponse
 */
export type ListCheckpointsResponse = Message$1<"mealplanner.api.ListCheckpointsResponse"> & {
    /**
     * @generated from field: repeated mealplanner.api.CheckpointEntry entries = 1;
     */
    entries: CheckpointEntry[];
};
/**
 * Describes the message mealplanner.api.ListCheckpointsResponse.
 * Use `create(ListCheckpointsResponseSchema)` to create a new message.
 */
export declare const ListCheckpointsResponseSchema: GenMessage<ListCheckpointsResponse>;
/**
 * @generated from message mealplanner.api.CheckpointEntry
 */
export type CheckpointEntry = Message$1<"mealplanner.api.CheckpointEntry"> & {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: string checkpoint_ns = 2;
     */
    checkpointNs: string;
    /**
     * @generated from field: mealplanner.api.CheckpointTuple tuple = 3;
     */
    tuple?: CheckpointTuple;
};
/**
 * Describes the message mealplanner.api.CheckpointEntry.
 * Use `create(CheckpointEntrySchema)` to create a new message.
 */
export declare const CheckpointEntrySchema: GenMessage<CheckpointEntry>;
/**
 * Logging Service Messages
 *
 * @generated from message mealplanner.api.LogEntry
 */
export type LogEntry = Message$1<"mealplanner.api.LogEntry"> & {
    /**
     * @generated from field: string service_name = 1;
     */
    serviceName: string;
    /**
     * DEBUG, INFO, WARN, ERROR
     *
     * @generated from field: string level = 2;
     */
    level: string;
    /**
     * @generated from field: string message = 3;
     */
    message: string;
    /**
     * @generated from field: google.protobuf.Timestamp timestamp = 4;
     */
    timestamp?: Timestamp;
    /**
     * optional correlation ID
     *
     * @generated from field: string thread_id = 5;
     */
    threadId: string;
    /**
     * optional component/module name
     *
     * @generated from field: string component = 6;
     */
    component: string;
    /**
     * structured fields
     *
     * @generated from field: map<string, string> fields = 7;
     */
    fields: {
        [key: string]: string;
    };
};
/**
 * Describes the message mealplanner.api.LogEntry.
 * Use `create(LogEntrySchema)` to create a new message.
 */
export declare const LogEntrySchema: GenMessage<LogEntry>;
/**
 * @generated from message mealplanner.api.LogRequest
 */
export type LogRequest = Message$1<"mealplanner.api.LogRequest"> & {
    /**
     * @generated from field: mealplanner.api.LogEntry entry = 1;
     */
    entry?: LogEntry;
};
/**
 * Describes the message mealplanner.api.LogRequest.
 * Use `create(LogRequestSchema)` to create a new message.
 */
export declare const LogRequestSchema: GenMessage<LogRequest>;
/**
 * @generated from message mealplanner.api.LogResponse
 */
export type LogResponse = Message$1<"mealplanner.api.LogResponse"> & {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
};
/**
 * Describes the message mealplanner.api.LogResponse.
 * Use `create(LogResponseSchema)` to create a new message.
 */
export declare const LogResponseSchema: GenMessage<LogResponse>;
/**
 * @generated from message mealplanner.api.LogBatchRequest
 */
export type LogBatchRequest = Message$1<"mealplanner.api.LogBatchRequest"> & {
    /**
     * @generated from field: repeated mealplanner.api.LogEntry entries = 1;
     */
    entries: LogEntry[];
};
/**
 * Describes the message mealplanner.api.LogBatchRequest.
 * Use `create(LogBatchRequestSchema)` to create a new message.
 */
export declare const LogBatchRequestSchema: GenMessage<LogBatchRequest>;
/**
 * @generated from message mealplanner.api.LogBatchResponse
 */
export type LogBatchResponse = Message$1<"mealplanner.api.LogBatchResponse"> & {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: int32 processed = 2;
     */
    processed: number;
    /**
     * @generated from field: repeated string errors = 3;
     */
    errors: string[];
};
/**
 * Describes the message mealplanner.api.LogBatchResponse.
 * Use `create(LogBatchResponseSchema)` to create a new message.
 */
export declare const LogBatchResponseSchema: GenMessage<LogBatchResponse>;
/**
 * Logging Service definition
 *
 * @generated from service mealplanner.api.LoggingService
 */
export declare const LoggingService: GenService<{
    /**
     * @generated from rpc mealplanner.api.LoggingService.Log
     */
    log: {
        methodKind: "unary";
        input: typeof LogRequestSchema;
        output: typeof LogResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.LoggingService.LogBatch
     */
    logBatch: {
        methodKind: "unary";
        input: typeof LogBatchRequestSchema;
        output: typeof LogBatchResponseSchema;
    };
}>;
/**
 * Service definition
 *
 * @generated from service mealplanner.api.MealPlannerAPI
 */
export declare const MealPlannerAPI: GenService<{
    /**
     * Health endpoints
     *
     * @generated from rpc mealplanner.api.MealPlannerAPI.HealthCheck
     */
    healthCheck: {
        methodKind: "unary";
        input: typeof EmptySchema;
        output: typeof HealthCheckResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.Reconnect
     */
    reconnect: {
        methodKind: "unary";
        input: typeof EmptySchema;
        output: typeof ReconnectResponseSchema;
    };
    /**
     * Meal plan endpoints
     *
     * @generated from rpc mealplanner.api.MealPlannerAPI.GetMealPlan
     */
    getMealPlan: {
        methodKind: "unary";
        input: typeof EmptySchema;
        output: typeof GetMealPlanResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.GenerateMealPlan
     */
    generateMealPlan: {
        methodKind: "unary";
        input: typeof EmptySchema;
        output: typeof GenerateMealPlanResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.FinalizeMealPlan
     */
    finalizeMealPlan: {
        methodKind: "unary";
        input: typeof FinalizeMealPlanRequestSchema;
        output: typeof FinalizeMealPlanResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.GetMealPlanICS
     */
    getMealPlanICS: {
        methodKind: "unary";
        input: typeof EmptySchema;
        output: typeof MealPlanICSResponseSchema;
    };
    /**
     * Shopping list endpoints
     *
     * @generated from rpc mealplanner.api.MealPlannerAPI.GetShoppingList
     */
    getShoppingList: {
        methodKind: "unary";
        input: typeof GetShoppingListRequestSchema;
        output: typeof GetShoppingListResponseSchema;
    };
    /**
     * Meals endpoints
     *
     * @generated from rpc mealplanner.api.MealPlannerAPI.GetAllMeals
     */
    getAllMeals: {
        methodKind: "unary";
        input: typeof GetAllMealsRequestSchema;
        output: typeof GetAllMealsResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.CreateMeal
     */
    createMeal: {
        methodKind: "unary";
        input: typeof CreateMealRequestSchema;
        output: typeof CreateMealResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.SwapMeal
     */
    swapMeal: {
        methodKind: "unary";
        input: typeof SwapMealRequestSchema;
        output: typeof SwapMealResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.RemoveMeal
     */
    removeMeal: {
        methodKind: "unary";
        input: typeof RemoveMealRequestSchema;
        output: typeof RemoveMealResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.ReplaceMeal
     */
    replaceMeal: {
        methodKind: "unary";
        input: typeof ReplaceMealRequestSchema;
        output: typeof ReplaceMealResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateMealIngredient
     */
    updateMealIngredient: {
        methodKind: "unary";
        input: typeof UpdateMealIngredientRequestSchema;
        output: typeof UpdateMealIngredientResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteMealIngredient
     */
    deleteMealIngredient: {
        methodKind: "unary";
        input: typeof DeleteMealIngredientRequestSchema;
        output: typeof DeleteMealIngredientResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteMeal
     */
    deleteMeal: {
        methodKind: "unary";
        input: typeof DeleteMealRequestSchema;
        output: typeof DeleteMealResponseSchema;
    };
    /**
     * Recipe steps endpoints
     *
     * @generated from rpc mealplanner.api.MealPlannerAPI.GetSteps
     */
    getSteps: {
        methodKind: "unary";
        input: typeof GetStepsRequestSchema;
        output: typeof GetStepsResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.AddStep
     */
    addStep: {
        methodKind: "unary";
        input: typeof AddStepRequestSchema;
        output: typeof AddStepResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.AddBulkSteps
     */
    addBulkSteps: {
        methodKind: "unary";
        input: typeof AddBulkStepsRequestSchema;
        output: typeof AddBulkStepsResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateStep
     */
    updateStep: {
        methodKind: "unary";
        input: typeof UpdateStepRequestSchema;
        output: typeof UpdateStepResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteStep
     */
    deleteStep: {
        methodKind: "unary";
        input: typeof DeleteStepRequestSchema;
        output: typeof DeleteStepResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.ReorderSteps
     */
    reorderSteps: {
        methodKind: "unary";
        input: typeof ReorderStepsRequestSchema;
        output: typeof ReorderStepsResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteAllSteps
     */
    deleteAllSteps: {
        methodKind: "unary";
        input: typeof DeleteAllStepsRequestSchema;
        output: typeof DeleteAllStepsResponseSchema;
    };
    /**
     * Agent workflow endpoints
     *
     * @generated from rpc mealplanner.api.MealPlannerAPI.StartAgentWorkflow
     */
    startAgentWorkflow: {
        methodKind: "unary";
        input: typeof StartAgentWorkflowRequestSchema;
        output: typeof StartAgentWorkflowResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.MessageAgent
     */
    messageAgent: {
        methodKind: "unary";
        input: typeof MessageAgentRequestSchema;
        output: typeof MessageAgentResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.GetWorkflowStatus
     */
    getWorkflowStatus: {
        methodKind: "unary";
        input: typeof GetWorkflowStatusRequestSchema;
        output: typeof GetWorkflowStatusResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.ListWorkflows
     */
    listWorkflows: {
        methodKind: "unary";
        input: typeof EmptySchema;
        output: typeof ListWorkflowsResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.CancelWorkflow
     */
    cancelWorkflow: {
        methodKind: "unary";
        input: typeof CancelWorkflowRequestSchema;
        output: typeof CancelWorkflowResponseSchema;
    };
    /**
     * Workflow management endpoints
     *
     * @generated from rpc mealplanner.api.MealPlannerAPI.GetWorkflowState
     */
    getWorkflowState: {
        methodKind: "unary";
        input: typeof GetWorkflowStateRequestSchema;
        output: typeof GetWorkflowStateResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.AbandonWorkflow
     */
    abandonWorkflow: {
        methodKind: "unary";
        input: typeof AbandonWorkflowRequestSchema;
        output: typeof AbandonWorkflowResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.AddMessage
     */
    addMessage: {
        methodKind: "unary";
        input: typeof AddMessageRequestSchema;
        output: typeof AddMessageResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateSessionState
     */
    updateSessionState: {
        methodKind: "unary";
        input: typeof UpdateSessionStateRequestSchema;
        output: typeof UpdateSessionStateResponseSchema;
    };
    /**
     * Checkpoint persistence endpoints
     *
     * @generated from rpc mealplanner.api.MealPlannerAPI.GetCheckpoint
     */
    getCheckpoint: {
        methodKind: "unary";
        input: typeof GetCheckpointRequestSchema;
        output: typeof GetCheckpointResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.PutCheckpoint
     */
    putCheckpoint: {
        methodKind: "unary";
        input: typeof PutCheckpointRequestSchema;
        output: typeof PutCheckpointResponseSchema;
    };
    /**
     * @generated from rpc mealplanner.api.MealPlannerAPI.ListCheckpoints
     */
    listCheckpoints: {
        methodKind: "unary";
        input: typeof ListCheckpointsRequestSchema;
        output: typeof ListCheckpointsResponseSchema;
    };
}>;
