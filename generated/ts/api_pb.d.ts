import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { Message as Message$1, proto3, Timestamp } from "@bufbuild/protobuf";
/**
 * @generated from message mealplanner.api.Ingredient
 */
export declare class Ingredient extends Message$1<Ingredient> {
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
    constructor(data?: PartialMessage<Ingredient>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.Ingredient";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Ingredient;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Ingredient;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Ingredient;
    static equals(a: Ingredient | PlainMessage<Ingredient> | undefined, b: Ingredient | PlainMessage<Ingredient> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.Step
 */
export declare class Step extends Message$1<Step> {
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
    constructor(data?: PartialMessage<Step>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.Step";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Step;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Step;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Step;
    static equals(a: Step | PlainMessage<Step> | undefined, b: Step | PlainMessage<Step> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.Meal
 */
export declare class Meal extends Message$1<Meal> {
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
    constructor(data?: PartialMessage<Meal>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.Meal";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Meal;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Meal;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Meal;
    static equals(a: Meal | PlainMessage<Meal> | undefined, b: Meal | PlainMessage<Meal> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.MealPlanEntry
 */
export declare class MealPlanEntry extends Message$1<MealPlanEntry> {
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
    constructor(data?: PartialMessage<MealPlanEntry>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.MealPlanEntry";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): MealPlanEntry;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): MealPlanEntry;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): MealPlanEntry;
    static equals(a: MealPlanEntry | PlainMessage<MealPlanEntry> | undefined, b: MealPlanEntry | PlainMessage<MealPlanEntry> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ShoppingListItem
 */
export declare class ShoppingListItem extends Message$1<ShoppingListItem> {
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
    constructor(data?: PartialMessage<ShoppingListItem>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ShoppingListItem";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ShoppingListItem;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ShoppingListItem;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ShoppingListItem;
    static equals(a: ShoppingListItem | PlainMessage<ShoppingListItem> | undefined, b: ShoppingListItem | PlainMessage<ShoppingListItem> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.WeeklyMealPlan
 */
export declare class WeeklyMealPlan extends Message$1<WeeklyMealPlan> {
    /**
     * @generated from field: repeated mealplanner.api.MealPlanEntry days = 1;
     */
    days: MealPlanEntry[];
    /**
     * @generated from field: repeated mealplanner.api.ShoppingListItem shopping_list = 2;
     */
    shoppingList: ShoppingListItem[];
    constructor(data?: PartialMessage<WeeklyMealPlan>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.WeeklyMealPlan";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): WeeklyMealPlan;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): WeeklyMealPlan;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): WeeklyMealPlan;
    static equals(a: WeeklyMealPlan | PlainMessage<WeeklyMealPlan> | undefined, b: WeeklyMealPlan | PlainMessage<WeeklyMealPlan> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.SaveMealPlanRequest
 */
export declare class SaveMealPlanRequest extends Message$1<SaveMealPlanRequest> {
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
    constructor(data?: PartialMessage<SaveMealPlanRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.SaveMealPlanRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): SaveMealPlanRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): SaveMealPlanRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): SaveMealPlanRequest;
    static equals(a: SaveMealPlanRequest | PlainMessage<SaveMealPlanRequest> | undefined, b: SaveMealPlanRequest | PlainMessage<SaveMealPlanRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.MealPlanIdentifier
 */
export declare class MealPlanIdentifier extends Message$1<MealPlanIdentifier> {
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
    constructor(data?: PartialMessage<MealPlanIdentifier>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.MealPlanIdentifier";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): MealPlanIdentifier;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): MealPlanIdentifier;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): MealPlanIdentifier;
    static equals(a: MealPlanIdentifier | PlainMessage<MealPlanIdentifier> | undefined, b: MealPlanIdentifier | PlainMessage<MealPlanIdentifier> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.SaveCheckpointRequest
 */
export declare class SaveCheckpointRequest extends Message$1<SaveCheckpointRequest> {
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
    constructor(data?: PartialMessage<SaveCheckpointRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.SaveCheckpointRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): SaveCheckpointRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): SaveCheckpointRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): SaveCheckpointRequest;
    static equals(a: SaveCheckpointRequest | PlainMessage<SaveCheckpointRequest> | undefined, b: SaveCheckpointRequest | PlainMessage<SaveCheckpointRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.CheckpointResponse
 */
export declare class CheckpointResponse extends Message$1<CheckpointResponse> {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    constructor(data?: PartialMessage<CheckpointResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.CheckpointResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CheckpointResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CheckpointResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CheckpointResponse;
    static equals(a: CheckpointResponse | PlainMessage<CheckpointResponse> | undefined, b: CheckpointResponse | PlainMessage<CheckpointResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.Message
 */
export declare class Message extends Message$1<Message> {
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
    constructor(data?: PartialMessage<Message>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.Message";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Message;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Message;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Message;
    static equals(a: Message | PlainMessage<Message> | undefined, b: Message | PlainMessage<Message> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ShoppingList
 */
export declare class ShoppingList extends Message$1<ShoppingList> {
    /**
     * @generated from field: repeated mealplanner.api.ShoppingListItem items = 1;
     */
    items: ShoppingListItem[];
    constructor(data?: PartialMessage<ShoppingList>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ShoppingList";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ShoppingList;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ShoppingList;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ShoppingList;
    static equals(a: ShoppingList | PlainMessage<ShoppingList> | undefined, b: ShoppingList | PlainMessage<ShoppingList> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AgentStartRequest
 */
export declare class AgentStartRequest extends Message$1<AgentStartRequest> {
    /**
     * @generated from field: repeated string participants = 1;
     */
    participants: string[];
    /**
     * @generated from field: string workflow_type = 2;
     */
    workflowType: string;
    constructor(data?: PartialMessage<AgentStartRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AgentStartRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AgentStartRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AgentStartRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AgentStartRequest;
    static equals(a: AgentStartRequest | PlainMessage<AgentStartRequest> | undefined, b: AgentStartRequest | PlainMessage<AgentStartRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AgentFeedbackRequest
 */
export declare class AgentFeedbackRequest extends Message$1<AgentFeedbackRequest> {
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
    constructor(data?: PartialMessage<AgentFeedbackRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AgentFeedbackRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AgentFeedbackRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AgentFeedbackRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AgentFeedbackRequest;
    static equals(a: AgentFeedbackRequest | PlainMessage<AgentFeedbackRequest> | undefined, b: AgentFeedbackRequest | PlainMessage<AgentFeedbackRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AgentResumeRequest
 */
export declare class AgentResumeRequest extends Message$1<AgentResumeRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    /**
     * @generated from field: bool interactive = 2;
     */
    interactive: boolean;
    constructor(data?: PartialMessage<AgentResumeRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AgentResumeRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AgentResumeRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AgentResumeRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AgentResumeRequest;
    static equals(a: AgentResumeRequest | PlainMessage<AgentResumeRequest> | undefined, b: AgentResumeRequest | PlainMessage<AgentResumeRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AgentMessageRequest
 */
export declare class AgentMessageRequest extends Message$1<AgentMessageRequest> {
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
    constructor(data?: PartialMessage<AgentMessageRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AgentMessageRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AgentMessageRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AgentMessageRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AgentMessageRequest;
    static equals(a: AgentMessageRequest | PlainMessage<AgentMessageRequest> | undefined, b: AgentMessageRequest | PlainMessage<AgentMessageRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AgentResponse
 */
export declare class AgentResponse extends Message$1<AgentResponse> {
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
    constructor(data?: PartialMessage<AgentResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AgentResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AgentResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AgentResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AgentResponse;
    static equals(a: AgentResponse | PlainMessage<AgentResponse> | undefined, b: AgentResponse | PlainMessage<AgentResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.WorkflowStatus
 */
export declare class WorkflowStatus extends Message$1<WorkflowStatus> {
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
    constructor(data?: PartialMessage<WorkflowStatus>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.WorkflowStatus";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): WorkflowStatus;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): WorkflowStatus;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): WorkflowStatus;
    static equals(a: WorkflowStatus | PlainMessage<WorkflowStatus> | undefined, b: WorkflowStatus | PlainMessage<WorkflowStatus> | undefined): boolean;
}
/**
 * Health endpoints
 *
 * @generated from message mealplanner.api.HealthCheckResponse
 */
export declare class HealthCheckResponse extends Message$1<HealthCheckResponse> {
    /**
     * @generated from field: string status = 1;
     */
    status: string;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    constructor(data?: PartialMessage<HealthCheckResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.HealthCheckResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): HealthCheckResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): HealthCheckResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): HealthCheckResponse;
    static equals(a: HealthCheckResponse | PlainMessage<HealthCheckResponse> | undefined, b: HealthCheckResponse | PlainMessage<HealthCheckResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ReconnectResponse
 */
export declare class ReconnectResponse extends Message$1<ReconnectResponse> {
    /**
     * @generated from field: string status = 1;
     */
    status: string;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    constructor(data?: PartialMessage<ReconnectResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ReconnectResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ReconnectResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ReconnectResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ReconnectResponse;
    static equals(a: ReconnectResponse | PlainMessage<ReconnectResponse> | undefined, b: ReconnectResponse | PlainMessage<ReconnectResponse> | undefined): boolean;
}
/**
 * Meal plan endpoints
 *
 * @generated from message mealplanner.api.GetMealPlanResponse
 */
export declare class GetMealPlanResponse extends Message$1<GetMealPlanResponse> {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
    constructor(data?: PartialMessage<GetMealPlanResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetMealPlanResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetMealPlanResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetMealPlanResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetMealPlanResponse;
    static equals(a: GetMealPlanResponse | PlainMessage<GetMealPlanResponse> | undefined, b: GetMealPlanResponse | PlainMessage<GetMealPlanResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GenerateMealPlanResponse
 */
export declare class GenerateMealPlanResponse extends Message$1<GenerateMealPlanResponse> {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
    constructor(data?: PartialMessage<GenerateMealPlanResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GenerateMealPlanResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GenerateMealPlanResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GenerateMealPlanResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GenerateMealPlanResponse;
    static equals(a: GenerateMealPlanResponse | PlainMessage<GenerateMealPlanResponse> | undefined, b: GenerateMealPlanResponse | PlainMessage<GenerateMealPlanResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.FinalizeMealPlanRequest
 */
export declare class FinalizeMealPlanRequest extends Message$1<FinalizeMealPlanRequest> {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
    constructor(data?: PartialMessage<FinalizeMealPlanRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.FinalizeMealPlanRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): FinalizeMealPlanRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): FinalizeMealPlanRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): FinalizeMealPlanRequest;
    static equals(a: FinalizeMealPlanRequest | PlainMessage<FinalizeMealPlanRequest> | undefined, b: FinalizeMealPlanRequest | PlainMessage<FinalizeMealPlanRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.FinalizeMealPlanResponse
 */
export declare class FinalizeMealPlanResponse extends Message$1<FinalizeMealPlanResponse> {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
    constructor(data?: PartialMessage<FinalizeMealPlanResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.FinalizeMealPlanResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): FinalizeMealPlanResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): FinalizeMealPlanResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): FinalizeMealPlanResponse;
    static equals(a: FinalizeMealPlanResponse | PlainMessage<FinalizeMealPlanResponse> | undefined, b: FinalizeMealPlanResponse | PlainMessage<FinalizeMealPlanResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.MealPlanICSResponse
 */
export declare class MealPlanICSResponse extends Message$1<MealPlanICSResponse> {
    /**
     * @generated from field: bytes ics_data = 1;
     */
    icsData: Uint8Array<ArrayBuffer>;
    constructor(data?: PartialMessage<MealPlanICSResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.MealPlanICSResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): MealPlanICSResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): MealPlanICSResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): MealPlanICSResponse;
    static equals(a: MealPlanICSResponse | PlainMessage<MealPlanICSResponse> | undefined, b: MealPlanICSResponse | PlainMessage<MealPlanICSResponse> | undefined): boolean;
}
/**
 * Shopping list endpoints
 *
 * @generated from message mealplanner.api.GetShoppingListRequest
 */
export declare class GetShoppingListRequest extends Message$1<GetShoppingListRequest> {
    /**
     * meal IDs
     *
     * @generated from field: repeated int32 plan = 1;
     */
    plan: number[];
    constructor(data?: PartialMessage<GetShoppingListRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetShoppingListRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetShoppingListRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetShoppingListRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetShoppingListRequest;
    static equals(a: GetShoppingListRequest | PlainMessage<GetShoppingListRequest> | undefined, b: GetShoppingListRequest | PlainMessage<GetShoppingListRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetShoppingListResponse
 */
export declare class GetShoppingListResponse extends Message$1<GetShoppingListResponse> {
    /**
     * @generated from field: repeated mealplanner.api.ShoppingListItem items = 1;
     */
    items: ShoppingListItem[];
    constructor(data?: PartialMessage<GetShoppingListResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetShoppingListResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetShoppingListResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetShoppingListResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetShoppingListResponse;
    static equals(a: GetShoppingListResponse | PlainMessage<GetShoppingListResponse> | undefined, b: GetShoppingListResponse | PlainMessage<GetShoppingListResponse> | undefined): boolean;
}
/**
 * Meals endpoints
 *
 * @generated from message mealplanner.api.GetAllMealsRequest
 */
export declare class GetAllMealsRequest extends Message$1<GetAllMealsRequest> {
    /**
     * optional filter by meal type
     *
     * @generated from field: string type = 1;
     */
    type: string;
    constructor(data?: PartialMessage<GetAllMealsRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetAllMealsRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetAllMealsRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetAllMealsRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetAllMealsRequest;
    static equals(a: GetAllMealsRequest | PlainMessage<GetAllMealsRequest> | undefined, b: GetAllMealsRequest | PlainMessage<GetAllMealsRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetAllMealsResponse
 */
export declare class GetAllMealsResponse extends Message$1<GetAllMealsResponse> {
    /**
     * @generated from field: repeated mealplanner.api.Meal meals = 1;
     */
    meals: Meal[];
    constructor(data?: PartialMessage<GetAllMealsResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetAllMealsResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetAllMealsResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetAllMealsResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetAllMealsResponse;
    static equals(a: GetAllMealsResponse | PlainMessage<GetAllMealsResponse> | undefined, b: GetAllMealsResponse | PlainMessage<GetAllMealsResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.CreateMealRequest
 */
export declare class CreateMealRequest extends Message$1<CreateMealRequest> {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
    constructor(data?: PartialMessage<CreateMealRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.CreateMealRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateMealRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateMealRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateMealRequest;
    static equals(a: CreateMealRequest | PlainMessage<CreateMealRequest> | undefined, b: CreateMealRequest | PlainMessage<CreateMealRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.CreateMealResponse
 */
export declare class CreateMealResponse extends Message$1<CreateMealResponse> {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
    constructor(data?: PartialMessage<CreateMealResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.CreateMealResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateMealResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateMealResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateMealResponse;
    static equals(a: CreateMealResponse | PlainMessage<CreateMealResponse> | undefined, b: CreateMealResponse | PlainMessage<CreateMealResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.SwapMealRequest
 */
export declare class SwapMealRequest extends Message$1<SwapMealRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: string meal_type = 2;
     */
    mealType: string;
    constructor(data?: PartialMessage<SwapMealRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.SwapMealRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): SwapMealRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): SwapMealRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): SwapMealRequest;
    static equals(a: SwapMealRequest | PlainMessage<SwapMealRequest> | undefined, b: SwapMealRequest | PlainMessage<SwapMealRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.SwapMealResponse
 */
export declare class SwapMealResponse extends Message$1<SwapMealResponse> {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
    constructor(data?: PartialMessage<SwapMealResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.SwapMealResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): SwapMealResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): SwapMealResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): SwapMealResponse;
    static equals(a: SwapMealResponse | PlainMessage<SwapMealResponse> | undefined, b: SwapMealResponse | PlainMessage<SwapMealResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.RemoveMealRequest
 */
export declare class RemoveMealRequest extends Message$1<RemoveMealRequest> {
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
    constructor(data?: PartialMessage<RemoveMealRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.RemoveMealRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): RemoveMealRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): RemoveMealRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): RemoveMealRequest;
    static equals(a: RemoveMealRequest | PlainMessage<RemoveMealRequest> | undefined, b: RemoveMealRequest | PlainMessage<RemoveMealRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.RemoveMealResponse
 */
export declare class RemoveMealResponse extends Message$1<RemoveMealResponse> {
    /**
     * @generated from field: mealplanner.api.WeeklyMealPlan plan = 1;
     */
    plan?: WeeklyMealPlan;
    constructor(data?: PartialMessage<RemoveMealResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.RemoveMealResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): RemoveMealResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): RemoveMealResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): RemoveMealResponse;
    static equals(a: RemoveMealResponse | PlainMessage<RemoveMealResponse> | undefined, b: RemoveMealResponse | PlainMessage<RemoveMealResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ReplaceMealRequest
 */
export declare class ReplaceMealRequest extends Message$1<ReplaceMealRequest> {
    /**
     * @generated from field: string day = 1;
     */
    day: string;
    /**
     * @generated from field: int32 new_meal_id = 2;
     */
    newMealId: number;
    constructor(data?: PartialMessage<ReplaceMealRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ReplaceMealRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ReplaceMealRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ReplaceMealRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ReplaceMealRequest;
    static equals(a: ReplaceMealRequest | PlainMessage<ReplaceMealRequest> | undefined, b: ReplaceMealRequest | PlainMessage<ReplaceMealRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ReplaceMealResponse
 */
export declare class ReplaceMealResponse extends Message$1<ReplaceMealResponse> {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
    constructor(data?: PartialMessage<ReplaceMealResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ReplaceMealResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ReplaceMealResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ReplaceMealResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ReplaceMealResponse;
    static equals(a: ReplaceMealResponse | PlainMessage<ReplaceMealResponse> | undefined, b: ReplaceMealResponse | PlainMessage<ReplaceMealResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.UpdateMealIngredientRequest
 */
export declare class UpdateMealIngredientRequest extends Message$1<UpdateMealIngredientRequest> {
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
    constructor(data?: PartialMessage<UpdateMealIngredientRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.UpdateMealIngredientRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateMealIngredientRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateMealIngredientRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateMealIngredientRequest;
    static equals(a: UpdateMealIngredientRequest | PlainMessage<UpdateMealIngredientRequest> | undefined, b: UpdateMealIngredientRequest | PlainMessage<UpdateMealIngredientRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.UpdateMealIngredientResponse
 */
export declare class UpdateMealIngredientResponse extends Message$1<UpdateMealIngredientResponse> {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
    constructor(data?: PartialMessage<UpdateMealIngredientResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.UpdateMealIngredientResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateMealIngredientResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateMealIngredientResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateMealIngredientResponse;
    static equals(a: UpdateMealIngredientResponse | PlainMessage<UpdateMealIngredientResponse> | undefined, b: UpdateMealIngredientResponse | PlainMessage<UpdateMealIngredientResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.DeleteMealIngredientRequest
 */
export declare class DeleteMealIngredientRequest extends Message$1<DeleteMealIngredientRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: int32 ingredient_id = 2;
     */
    ingredientId: number;
    constructor(data?: PartialMessage<DeleteMealIngredientRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.DeleteMealIngredientRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteMealIngredientRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteMealIngredientRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteMealIngredientRequest;
    static equals(a: DeleteMealIngredientRequest | PlainMessage<DeleteMealIngredientRequest> | undefined, b: DeleteMealIngredientRequest | PlainMessage<DeleteMealIngredientRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.DeleteMealIngredientResponse
 */
export declare class DeleteMealIngredientResponse extends Message$1<DeleteMealIngredientResponse> {
    /**
     * @generated from field: mealplanner.api.Meal meal = 1;
     */
    meal?: Meal;
    constructor(data?: PartialMessage<DeleteMealIngredientResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.DeleteMealIngredientResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteMealIngredientResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteMealIngredientResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteMealIngredientResponse;
    static equals(a: DeleteMealIngredientResponse | PlainMessage<DeleteMealIngredientResponse> | undefined, b: DeleteMealIngredientResponse | PlainMessage<DeleteMealIngredientResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.DeleteMealRequest
 */
export declare class DeleteMealRequest extends Message$1<DeleteMealRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    constructor(data?: PartialMessage<DeleteMealRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.DeleteMealRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteMealRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteMealRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteMealRequest;
    static equals(a: DeleteMealRequest | PlainMessage<DeleteMealRequest> | undefined, b: DeleteMealRequest | PlainMessage<DeleteMealRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.DeleteMealResponse
 */
export declare class DeleteMealResponse extends Message$1<DeleteMealResponse> {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
    constructor(data?: PartialMessage<DeleteMealResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.DeleteMealResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteMealResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteMealResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteMealResponse;
    static equals(a: DeleteMealResponse | PlainMessage<DeleteMealResponse> | undefined, b: DeleteMealResponse | PlainMessage<DeleteMealResponse> | undefined): boolean;
}
/**
 * Recipe steps endpoints
 *
 * @generated from message mealplanner.api.GetStepsRequest
 */
export declare class GetStepsRequest extends Message$1<GetStepsRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    constructor(data?: PartialMessage<GetStepsRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetStepsRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetStepsRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetStepsRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetStepsRequest;
    static equals(a: GetStepsRequest | PlainMessage<GetStepsRequest> | undefined, b: GetStepsRequest | PlainMessage<GetStepsRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetStepsResponse
 */
export declare class GetStepsResponse extends Message$1<GetStepsResponse> {
    /**
     * @generated from field: repeated mealplanner.api.Step steps = 1;
     */
    steps: Step[];
    constructor(data?: PartialMessage<GetStepsResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetStepsResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetStepsResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetStepsResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetStepsResponse;
    static equals(a: GetStepsResponse | PlainMessage<GetStepsResponse> | undefined, b: GetStepsResponse | PlainMessage<GetStepsResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AddStepRequest
 */
export declare class AddStepRequest extends Message$1<AddStepRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: mealplanner.api.Step step = 2;
     */
    step?: Step;
    constructor(data?: PartialMessage<AddStepRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AddStepRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AddStepRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AddStepRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AddStepRequest;
    static equals(a: AddStepRequest | PlainMessage<AddStepRequest> | undefined, b: AddStepRequest | PlainMessage<AddStepRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AddStepResponse
 */
export declare class AddStepResponse extends Message$1<AddStepResponse> {
    /**
     * @generated from field: mealplanner.api.Step step = 1;
     */
    step?: Step;
    constructor(data?: PartialMessage<AddStepResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AddStepResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AddStepResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AddStepResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AddStepResponse;
    static equals(a: AddStepResponse | PlainMessage<AddStepResponse> | undefined, b: AddStepResponse | PlainMessage<AddStepResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AddBulkStepsRequest
 */
export declare class AddBulkStepsRequest extends Message$1<AddBulkStepsRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: repeated string instructions = 2;
     */
    instructions: string[];
    constructor(data?: PartialMessage<AddBulkStepsRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AddBulkStepsRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AddBulkStepsRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AddBulkStepsRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AddBulkStepsRequest;
    static equals(a: AddBulkStepsRequest | PlainMessage<AddBulkStepsRequest> | undefined, b: AddBulkStepsRequest | PlainMessage<AddBulkStepsRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AddBulkStepsResponse
 */
export declare class AddBulkStepsResponse extends Message$1<AddBulkStepsResponse> {
    /**
     * @generated from field: repeated mealplanner.api.Step steps = 1;
     */
    steps: Step[];
    constructor(data?: PartialMessage<AddBulkStepsResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AddBulkStepsResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AddBulkStepsResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AddBulkStepsResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AddBulkStepsResponse;
    static equals(a: AddBulkStepsResponse | PlainMessage<AddBulkStepsResponse> | undefined, b: AddBulkStepsResponse | PlainMessage<AddBulkStepsResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.UpdateStepRequest
 */
export declare class UpdateStepRequest extends Message$1<UpdateStepRequest> {
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
    constructor(data?: PartialMessage<UpdateStepRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.UpdateStepRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateStepRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateStepRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateStepRequest;
    static equals(a: UpdateStepRequest | PlainMessage<UpdateStepRequest> | undefined, b: UpdateStepRequest | PlainMessage<UpdateStepRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.UpdateStepResponse
 */
export declare class UpdateStepResponse extends Message$1<UpdateStepResponse> {
    /**
     * @generated from field: mealplanner.api.Step step = 1;
     */
    step?: Step;
    constructor(data?: PartialMessage<UpdateStepResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.UpdateStepResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateStepResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateStepResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateStepResponse;
    static equals(a: UpdateStepResponse | PlainMessage<UpdateStepResponse> | undefined, b: UpdateStepResponse | PlainMessage<UpdateStepResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.DeleteStepRequest
 */
export declare class DeleteStepRequest extends Message$1<DeleteStepRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: int32 step_id = 2;
     */
    stepId: number;
    constructor(data?: PartialMessage<DeleteStepRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.DeleteStepRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteStepRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteStepRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteStepRequest;
    static equals(a: DeleteStepRequest | PlainMessage<DeleteStepRequest> | undefined, b: DeleteStepRequest | PlainMessage<DeleteStepRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.DeleteStepResponse
 */
export declare class DeleteStepResponse extends Message$1<DeleteStepResponse> {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
    constructor(data?: PartialMessage<DeleteStepResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.DeleteStepResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteStepResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteStepResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteStepResponse;
    static equals(a: DeleteStepResponse | PlainMessage<DeleteStepResponse> | undefined, b: DeleteStepResponse | PlainMessage<DeleteStepResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ReorderStepsRequest
 */
export declare class ReorderStepsRequest extends Message$1<ReorderStepsRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    /**
     * @generated from field: repeated int32 step_ids = 2;
     */
    stepIds: number[];
    constructor(data?: PartialMessage<ReorderStepsRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ReorderStepsRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ReorderStepsRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ReorderStepsRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ReorderStepsRequest;
    static equals(a: ReorderStepsRequest | PlainMessage<ReorderStepsRequest> | undefined, b: ReorderStepsRequest | PlainMessage<ReorderStepsRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ReorderStepsResponse
 */
export declare class ReorderStepsResponse extends Message$1<ReorderStepsResponse> {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
    constructor(data?: PartialMessage<ReorderStepsResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ReorderStepsResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ReorderStepsResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ReorderStepsResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ReorderStepsResponse;
    static equals(a: ReorderStepsResponse | PlainMessage<ReorderStepsResponse> | undefined, b: ReorderStepsResponse | PlainMessage<ReorderStepsResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.DeleteAllStepsRequest
 */
export declare class DeleteAllStepsRequest extends Message$1<DeleteAllStepsRequest> {
    /**
     * @generated from field: int32 meal_id = 1;
     */
    mealId: number;
    constructor(data?: PartialMessage<DeleteAllStepsRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.DeleteAllStepsRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteAllStepsRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteAllStepsRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteAllStepsRequest;
    static equals(a: DeleteAllStepsRequest | PlainMessage<DeleteAllStepsRequest> | undefined, b: DeleteAllStepsRequest | PlainMessage<DeleteAllStepsRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.DeleteAllStepsResponse
 */
export declare class DeleteAllStepsResponse extends Message$1<DeleteAllStepsResponse> {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
    constructor(data?: PartialMessage<DeleteAllStepsResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.DeleteAllStepsResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteAllStepsResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteAllStepsResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteAllStepsResponse;
    static equals(a: DeleteAllStepsResponse | PlainMessage<DeleteAllStepsResponse> | undefined, b: DeleteAllStepsResponse | PlainMessage<DeleteAllStepsResponse> | undefined): boolean;
}
/**
 * Agent workflow endpoints
 *
 * @generated from message mealplanner.api.StartAgentWorkflowRequest
 */
export declare class StartAgentWorkflowRequest extends Message$1<StartAgentWorkflowRequest> {
    /**
     * @generated from field: mealplanner.api.AgentStartRequest request = 1;
     */
    request?: AgentStartRequest;
    constructor(data?: PartialMessage<StartAgentWorkflowRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.StartAgentWorkflowRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): StartAgentWorkflowRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): StartAgentWorkflowRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): StartAgentWorkflowRequest;
    static equals(a: StartAgentWorkflowRequest | PlainMessage<StartAgentWorkflowRequest> | undefined, b: StartAgentWorkflowRequest | PlainMessage<StartAgentWorkflowRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.StartAgentWorkflowResponse
 */
export declare class StartAgentWorkflowResponse extends Message$1<StartAgentWorkflowResponse> {
    /**
     * @generated from field: mealplanner.api.AgentResponse response = 1;
     */
    response?: AgentResponse;
    constructor(data?: PartialMessage<StartAgentWorkflowResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.StartAgentWorkflowResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): StartAgentWorkflowResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): StartAgentWorkflowResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): StartAgentWorkflowResponse;
    static equals(a: StartAgentWorkflowResponse | PlainMessage<StartAgentWorkflowResponse> | undefined, b: StartAgentWorkflowResponse | PlainMessage<StartAgentWorkflowResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.MessageAgentRequest
 */
export declare class MessageAgentRequest extends Message$1<MessageAgentRequest> {
    /**
     * @generated from field: mealplanner.api.AgentMessageRequest request = 1;
     */
    request?: AgentMessageRequest;
    constructor(data?: PartialMessage<MessageAgentRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.MessageAgentRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): MessageAgentRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): MessageAgentRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): MessageAgentRequest;
    static equals(a: MessageAgentRequest | PlainMessage<MessageAgentRequest> | undefined, b: MessageAgentRequest | PlainMessage<MessageAgentRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.MessageAgentResponse
 */
export declare class MessageAgentResponse extends Message$1<MessageAgentResponse> {
    /**
     * @generated from field: mealplanner.api.AgentResponse response = 1;
     */
    response?: AgentResponse;
    constructor(data?: PartialMessage<MessageAgentResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.MessageAgentResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): MessageAgentResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): MessageAgentResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): MessageAgentResponse;
    static equals(a: MessageAgentResponse | PlainMessage<MessageAgentResponse> | undefined, b: MessageAgentResponse | PlainMessage<MessageAgentResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetWorkflowStatusRequest
 */
export declare class GetWorkflowStatusRequest extends Message$1<GetWorkflowStatusRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    constructor(data?: PartialMessage<GetWorkflowStatusRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetWorkflowStatusRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetWorkflowStatusRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetWorkflowStatusRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetWorkflowStatusRequest;
    static equals(a: GetWorkflowStatusRequest | PlainMessage<GetWorkflowStatusRequest> | undefined, b: GetWorkflowStatusRequest | PlainMessage<GetWorkflowStatusRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetWorkflowStatusResponse
 */
export declare class GetWorkflowStatusResponse extends Message$1<GetWorkflowStatusResponse> {
    /**
     * @generated from field: mealplanner.api.WorkflowStatus status = 1;
     */
    status?: WorkflowStatus;
    constructor(data?: PartialMessage<GetWorkflowStatusResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetWorkflowStatusResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetWorkflowStatusResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetWorkflowStatusResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetWorkflowStatusResponse;
    static equals(a: GetWorkflowStatusResponse | PlainMessage<GetWorkflowStatusResponse> | undefined, b: GetWorkflowStatusResponse | PlainMessage<GetWorkflowStatusResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ListWorkflowsResponse
 */
export declare class ListWorkflowsResponse extends Message$1<ListWorkflowsResponse> {
    /**
     * @generated from field: repeated mealplanner.api.WorkflowStatus workflows = 1;
     */
    workflows: WorkflowStatus[];
    constructor(data?: PartialMessage<ListWorkflowsResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ListWorkflowsResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListWorkflowsResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListWorkflowsResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListWorkflowsResponse;
    static equals(a: ListWorkflowsResponse | PlainMessage<ListWorkflowsResponse> | undefined, b: ListWorkflowsResponse | PlainMessage<ListWorkflowsResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.CancelWorkflowRequest
 */
export declare class CancelWorkflowRequest extends Message$1<CancelWorkflowRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    constructor(data?: PartialMessage<CancelWorkflowRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.CancelWorkflowRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CancelWorkflowRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CancelWorkflowRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CancelWorkflowRequest;
    static equals(a: CancelWorkflowRequest | PlainMessage<CancelWorkflowRequest> | undefined, b: CancelWorkflowRequest | PlainMessage<CancelWorkflowRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.CancelWorkflowResponse
 */
export declare class CancelWorkflowResponse extends Message$1<CancelWorkflowResponse> {
    /**
     * @generated from field: string status = 1;
     */
    status: string;
    constructor(data?: PartialMessage<CancelWorkflowResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.CancelWorkflowResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CancelWorkflowResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CancelWorkflowResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CancelWorkflowResponse;
    static equals(a: CancelWorkflowResponse | PlainMessage<CancelWorkflowResponse> | undefined, b: CancelWorkflowResponse | PlainMessage<CancelWorkflowResponse> | undefined): boolean;
}
/**
 * Workflow management endpoints
 *
 * @generated from message mealplanner.api.GetWorkflowStateRequest
 */
export declare class GetWorkflowStateRequest extends Message$1<GetWorkflowStateRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    constructor(data?: PartialMessage<GetWorkflowStateRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetWorkflowStateRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetWorkflowStateRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetWorkflowStateRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetWorkflowStateRequest;
    static equals(a: GetWorkflowStateRequest | PlainMessage<GetWorkflowStateRequest> | undefined, b: GetWorkflowStateRequest | PlainMessage<GetWorkflowStateRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetWorkflowStateResponse
 */
export declare class GetWorkflowStateResponse extends Message$1<GetWorkflowStateResponse> {
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
    constructor(data?: PartialMessage<GetWorkflowStateResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetWorkflowStateResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetWorkflowStateResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetWorkflowStateResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetWorkflowStateResponse;
    static equals(a: GetWorkflowStateResponse | PlainMessage<GetWorkflowStateResponse> | undefined, b: GetWorkflowStateResponse | PlainMessage<GetWorkflowStateResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AbandonWorkflowRequest
 */
export declare class AbandonWorkflowRequest extends Message$1<AbandonWorkflowRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    constructor(data?: PartialMessage<AbandonWorkflowRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AbandonWorkflowRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AbandonWorkflowRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AbandonWorkflowRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AbandonWorkflowRequest;
    static equals(a: AbandonWorkflowRequest | PlainMessage<AbandonWorkflowRequest> | undefined, b: AbandonWorkflowRequest | PlainMessage<AbandonWorkflowRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AbandonWorkflowResponse
 */
export declare class AbandonWorkflowResponse extends Message$1<AbandonWorkflowResponse> {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
    constructor(data?: PartialMessage<AbandonWorkflowResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AbandonWorkflowResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AbandonWorkflowResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AbandonWorkflowResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AbandonWorkflowResponse;
    static equals(a: AbandonWorkflowResponse | PlainMessage<AbandonWorkflowResponse> | undefined, b: AbandonWorkflowResponse | PlainMessage<AbandonWorkflowResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AddMessageRequest
 */
export declare class AddMessageRequest extends Message$1<AddMessageRequest> {
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
    constructor(data?: PartialMessage<AddMessageRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AddMessageRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AddMessageRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AddMessageRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AddMessageRequest;
    static equals(a: AddMessageRequest | PlainMessage<AddMessageRequest> | undefined, b: AddMessageRequest | PlainMessage<AddMessageRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AddMessageResponse
 */
export declare class AddMessageResponse extends Message$1<AddMessageResponse> {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
    constructor(data?: PartialMessage<AddMessageResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AddMessageResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AddMessageResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AddMessageResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AddMessageResponse;
    static equals(a: AddMessageResponse | PlainMessage<AddMessageResponse> | undefined, b: AddMessageResponse | PlainMessage<AddMessageResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetMessagesRequest
 */
export declare class GetMessagesRequest extends Message$1<GetMessagesRequest> {
    /**
     * @generated from field: string thread_id = 1;
     */
    threadId: string;
    constructor(data?: PartialMessage<GetMessagesRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetMessagesRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetMessagesRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetMessagesRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetMessagesRequest;
    static equals(a: GetMessagesRequest | PlainMessage<GetMessagesRequest> | undefined, b: GetMessagesRequest | PlainMessage<GetMessagesRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetMessagesResponse
 */
export declare class GetMessagesResponse extends Message$1<GetMessagesResponse> {
    /**
     * @generated from field: repeated mealplanner.api.Message messages = 1;
     */
    messages: Message[];
    constructor(data?: PartialMessage<GetMessagesResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetMessagesResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetMessagesResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetMessagesResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetMessagesResponse;
    static equals(a: GetMessagesResponse | PlainMessage<GetMessagesResponse> | undefined, b: GetMessagesResponse | PlainMessage<GetMessagesResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.UpdateSessionStateRequest
 */
export declare class UpdateSessionStateRequest extends Message$1<UpdateSessionStateRequest> {
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
    constructor(data?: PartialMessage<UpdateSessionStateRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.UpdateSessionStateRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateSessionStateRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateSessionStateRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateSessionStateRequest;
    static equals(a: UpdateSessionStateRequest | PlainMessage<UpdateSessionStateRequest> | undefined, b: UpdateSessionStateRequest | PlainMessage<UpdateSessionStateRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.UpdateSessionStateResponse
 */
export declare class UpdateSessionStateResponse extends Message$1<UpdateSessionStateResponse> {
    /**
     * @generated from field: string message = 1;
     */
    message: string;
    constructor(data?: PartialMessage<UpdateSessionStateResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.UpdateSessionStateResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateSessionStateResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateSessionStateResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateSessionStateResponse;
    static equals(a: UpdateSessionStateResponse | PlainMessage<UpdateSessionStateResponse> | undefined, b: UpdateSessionStateResponse | PlainMessage<UpdateSessionStateResponse> | undefined): boolean;
}
/**
 * Feedback entry reused inside MealPlanningState and checkpoints
 *
 * @generated from message mealplanner.api.FeedbackEntryProto
 */
export declare class FeedbackEntryProto extends Message$1<FeedbackEntryProto> {
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
    constructor(data?: PartialMessage<FeedbackEntryProto>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.FeedbackEntryProto";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): FeedbackEntryProto;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): FeedbackEntryProto;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): FeedbackEntryProto;
    static equals(a: FeedbackEntryProto | PlainMessage<FeedbackEntryProto> | undefined, b: FeedbackEntryProto | PlainMessage<FeedbackEntryProto> | undefined): boolean;
}
/**
 * Strictly-typed state for the meal-planning workflow
 *
 * @generated from message mealplanner.api.MealPlanningCheckpointState
 */
export declare class MealPlanningCheckpointState extends Message$1<MealPlanningCheckpointState> {
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
    constructor(data?: PartialMessage<MealPlanningCheckpointState>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.MealPlanningCheckpointState";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): MealPlanningCheckpointState;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): MealPlanningCheckpointState;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): MealPlanningCheckpointState;
    static equals(a: MealPlanningCheckpointState | PlainMessage<MealPlanningCheckpointState> | undefined, b: MealPlanningCheckpointState | PlainMessage<MealPlanningCheckpointState> | undefined): boolean;
}
/**
 * LangGraph checkpoint persistence (strict)
 *
 * @generated from message mealplanner.api.AgentCheckpoint
 */
export declare class AgentCheckpoint extends Message$1<AgentCheckpoint> {
    /**
     * @generated from field: mealplanner.api.MealPlanningCheckpointState state = 1;
     */
    state?: MealPlanningCheckpointState;
    /**
     * @generated from field: repeated string next = 2;
     */
    next: string[];
    /**
     * @generated from field: int32 step = 3;
     */
    step: number;
    constructor(data?: PartialMessage<AgentCheckpoint>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AgentCheckpoint";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AgentCheckpoint;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AgentCheckpoint;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AgentCheckpoint;
    static equals(a: AgentCheckpoint | PlainMessage<AgentCheckpoint> | undefined, b: AgentCheckpoint | PlainMessage<AgentCheckpoint> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.AgentCheckpointMetadata
 */
export declare class AgentCheckpointMetadata extends Message$1<AgentCheckpointMetadata> {
    /**
     * @generated from field: string source = 1;
     */
    source: string;
    /**
     * @generated from field: int32 step = 2;
     */
    step: number;
    constructor(data?: PartialMessage<AgentCheckpointMetadata>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.AgentCheckpointMetadata";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AgentCheckpointMetadata;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AgentCheckpointMetadata;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AgentCheckpointMetadata;
    static equals(a: AgentCheckpointMetadata | PlainMessage<AgentCheckpointMetadata> | undefined, b: AgentCheckpointMetadata | PlainMessage<AgentCheckpointMetadata> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.CheckpointTuple
 */
export declare class CheckpointTuple extends Message$1<CheckpointTuple> {
    /**
     * @generated from field: mealplanner.api.AgentCheckpoint checkpoint = 1;
     */
    checkpoint?: AgentCheckpoint;
    /**
     * @generated from field: mealplanner.api.AgentCheckpointMetadata metadata = 2;
     */
    metadata?: AgentCheckpointMetadata;
    constructor(data?: PartialMessage<CheckpointTuple>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.CheckpointTuple";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CheckpointTuple;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CheckpointTuple;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CheckpointTuple;
    static equals(a: CheckpointTuple | PlainMessage<CheckpointTuple> | undefined, b: CheckpointTuple | PlainMessage<CheckpointTuple> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetCheckpointRequest
 */
export declare class GetCheckpointRequest extends Message$1<GetCheckpointRequest> {
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
    constructor(data?: PartialMessage<GetCheckpointRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetCheckpointRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetCheckpointRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetCheckpointRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetCheckpointRequest;
    static equals(a: GetCheckpointRequest | PlainMessage<GetCheckpointRequest> | undefined, b: GetCheckpointRequest | PlainMessage<GetCheckpointRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.GetCheckpointResponse
 */
export declare class GetCheckpointResponse extends Message$1<GetCheckpointResponse> {
    /**
     * @generated from field: mealplanner.api.CheckpointTuple tuple = 1;
     */
    tuple?: CheckpointTuple;
    /**
     * @generated from field: bool found = 2;
     */
    found: boolean;
    constructor(data?: PartialMessage<GetCheckpointResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.GetCheckpointResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetCheckpointResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetCheckpointResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetCheckpointResponse;
    static equals(a: GetCheckpointResponse | PlainMessage<GetCheckpointResponse> | undefined, b: GetCheckpointResponse | PlainMessage<GetCheckpointResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.PutCheckpointRequest
 */
export declare class PutCheckpointRequest extends Message$1<PutCheckpointRequest> {
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
    constructor(data?: PartialMessage<PutCheckpointRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.PutCheckpointRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PutCheckpointRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PutCheckpointRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PutCheckpointRequest;
    static equals(a: PutCheckpointRequest | PlainMessage<PutCheckpointRequest> | undefined, b: PutCheckpointRequest | PlainMessage<PutCheckpointRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.PutCheckpointResponse
 */
export declare class PutCheckpointResponse extends Message$1<PutCheckpointResponse> {
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
    constructor(data?: PartialMessage<PutCheckpointResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.PutCheckpointResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PutCheckpointResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PutCheckpointResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PutCheckpointResponse;
    static equals(a: PutCheckpointResponse | PlainMessage<PutCheckpointResponse> | undefined, b: PutCheckpointResponse | PlainMessage<PutCheckpointResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ListCheckpointsRequest
 */
export declare class ListCheckpointsRequest extends Message$1<ListCheckpointsRequest> {
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
    constructor(data?: PartialMessage<ListCheckpointsRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ListCheckpointsRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListCheckpointsRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListCheckpointsRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListCheckpointsRequest;
    static equals(a: ListCheckpointsRequest | PlainMessage<ListCheckpointsRequest> | undefined, b: ListCheckpointsRequest | PlainMessage<ListCheckpointsRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.ListCheckpointsResponse
 */
export declare class ListCheckpointsResponse extends Message$1<ListCheckpointsResponse> {
    /**
     * @generated from field: repeated mealplanner.api.CheckpointEntry entries = 1;
     */
    entries: CheckpointEntry[];
    constructor(data?: PartialMessage<ListCheckpointsResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.ListCheckpointsResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListCheckpointsResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListCheckpointsResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListCheckpointsResponse;
    static equals(a: ListCheckpointsResponse | PlainMessage<ListCheckpointsResponse> | undefined, b: ListCheckpointsResponse | PlainMessage<ListCheckpointsResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.CheckpointEntry
 */
export declare class CheckpointEntry extends Message$1<CheckpointEntry> {
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
    constructor(data?: PartialMessage<CheckpointEntry>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.CheckpointEntry";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CheckpointEntry;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CheckpointEntry;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CheckpointEntry;
    static equals(a: CheckpointEntry | PlainMessage<CheckpointEntry> | undefined, b: CheckpointEntry | PlainMessage<CheckpointEntry> | undefined): boolean;
}
/**
 * Logging Service Messages
 *
 * @generated from message mealplanner.api.LogEntry
 */
export declare class LogEntry extends Message$1<LogEntry> {
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
    constructor(data?: PartialMessage<LogEntry>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.LogEntry";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): LogEntry;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): LogEntry;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): LogEntry;
    static equals(a: LogEntry | PlainMessage<LogEntry> | undefined, b: LogEntry | PlainMessage<LogEntry> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.LogRequest
 */
export declare class LogRequest extends Message$1<LogRequest> {
    /**
     * @generated from field: mealplanner.api.LogEntry entry = 1;
     */
    entry?: LogEntry;
    constructor(data?: PartialMessage<LogRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.LogRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): LogRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): LogRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): LogRequest;
    static equals(a: LogRequest | PlainMessage<LogRequest> | undefined, b: LogRequest | PlainMessage<LogRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.LogResponse
 */
export declare class LogResponse extends Message$1<LogResponse> {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
    /**
     * @generated from field: string message = 2;
     */
    message: string;
    constructor(data?: PartialMessage<LogResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.LogResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): LogResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): LogResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): LogResponse;
    static equals(a: LogResponse | PlainMessage<LogResponse> | undefined, b: LogResponse | PlainMessage<LogResponse> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.LogBatchRequest
 */
export declare class LogBatchRequest extends Message$1<LogBatchRequest> {
    /**
     * @generated from field: repeated mealplanner.api.LogEntry entries = 1;
     */
    entries: LogEntry[];
    constructor(data?: PartialMessage<LogBatchRequest>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.LogBatchRequest";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): LogBatchRequest;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): LogBatchRequest;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): LogBatchRequest;
    static equals(a: LogBatchRequest | PlainMessage<LogBatchRequest> | undefined, b: LogBatchRequest | PlainMessage<LogBatchRequest> | undefined): boolean;
}
/**
 * @generated from message mealplanner.api.LogBatchResponse
 */
export declare class LogBatchResponse extends Message$1<LogBatchResponse> {
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
    constructor(data?: PartialMessage<LogBatchResponse>);
    static readonly runtime: typeof proto3;
    static readonly typeName = "mealplanner.api.LogBatchResponse";
    static readonly fields: FieldList;
    static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): LogBatchResponse;
    static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): LogBatchResponse;
    static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): LogBatchResponse;
    static equals(a: LogBatchResponse | PlainMessage<LogBatchResponse> | undefined, b: LogBatchResponse | PlainMessage<LogBatchResponse> | undefined): boolean;
}
