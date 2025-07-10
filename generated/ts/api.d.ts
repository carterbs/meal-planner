import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { Any } from "./google/protobuf/any";
import { Empty } from "./google/protobuf/empty";
export declare const protobufPackage = "mealplanner.api";
export interface Ingredient {
    id: number;
    mealId: number;
    quantity: number;
    unit: string;
    name: string;
}
export interface Step {
    id: number;
    mealId: number;
    stepNumber: number;
    instruction: string;
}
export interface Meal {
    id: number;
    name: string;
    effort: number;
    lastPlanned: Date | undefined;
    hasRedMeat: boolean;
    url: string;
    mealType: string;
    ingredients: Ingredient[];
    steps: Step[];
}
export interface PlanDay {
    meal: Meal | undefined;
    dayIndex: number;
    mealType: string;
}
export interface ShoppingListItem {
    ingredient: string;
    quantity: string;
    category: string;
}
export interface WeeklyMealPlan {
    days: PlanDay[];
    shoppingList: ShoppingListItem[];
}
export interface MealPlanEntry {
    /** 0=Monday..6=Sunday */
    dayIndex: number;
    /** breakfast, lunch, dinner */
    mealType: string;
    meal: Meal | undefined;
}
export interface SaveMealPlanRequest {
    threadId: string;
    version: number;
    entries: MealPlanEntry[];
}
export interface MealPlanIdentifier {
    id: number;
    threadId: string;
    version: number;
    createdAt: string;
}
export interface SaveCheckpointRequest {
    threadId: string;
    version: number;
    entries: MealPlanEntry[];
}
export interface CheckpointResponse {
    success: boolean;
}
export interface Message {
    threadId: string;
    /** "user" or "agent" */
    sender: string;
    content: string;
    createdAt: string;
}
export interface ShoppingList {
    items: ShoppingListItem[];
}
export interface AgentStartRequest {
    participants: string[];
    workflowType: string;
}
export interface AgentFeedbackRequest {
    threadId: string;
    message: string;
    from: string;
}
export interface AgentResumeRequest {
    threadId: string;
    interactive: boolean;
}
export interface AgentMessageRequest {
    threadId: string;
    message: string;
    from: string;
    interactive: boolean;
}
export interface AgentResponse {
    success: boolean;
    message: string;
    threadId: string;
    currentStep: string;
    /** JSON string */
    initialState: string;
    /** JSON string */
    raw: string;
}
export interface WorkflowStatus {
    threadId: string;
    workflowType: string;
    currentStep: string;
    participants: string[];
}
/** Health endpoints */
export interface HealthCheckResponse {
    status: string;
    message: string;
}
export interface ReconnectResponse {
    status: string;
    message: string;
}
/** Meal plan endpoints */
export interface GetMealPlanResponse {
    plan: WeeklyMealPlan | undefined;
}
export interface GenerateMealPlanResponse {
    plan: WeeklyMealPlan | undefined;
}
export interface FinalizeMealPlanRequest {
    plan: WeeklyMealPlan | undefined;
}
export interface FinalizeMealPlanResponse {
    message: string;
}
export interface MealPlanICSResponse {
    icsData: Uint8Array;
}
/** Shopping list endpoints */
export interface GetShoppingListRequest {
    /** meal IDs */
    plan: number[];
}
export interface GetShoppingListResponse {
    items: ShoppingListItem[];
}
/** Meals endpoints */
export interface GetAllMealsRequest {
    /** optional filter by meal type */
    type: string;
}
export interface GetAllMealsResponse {
    meals: Meal[];
}
export interface CreateMealRequest {
    meal: Meal | undefined;
}
export interface CreateMealResponse {
    meal: Meal | undefined;
}
export interface SwapMealRequest {
    mealId: number;
    mealType: string;
}
export interface SwapMealResponse {
    meal: Meal | undefined;
}
export interface RemoveMealRequest {
    threadId: string;
    dayIndex: number;
    mealType: string;
}
export interface RemoveMealResponse {
    plan: WeeklyMealPlan | undefined;
}
export interface ReplaceMealRequest {
    day: string;
    newMealId: number;
}
export interface ReplaceMealResponse {
    meal: Meal | undefined;
}
export interface UpdateMealIngredientRequest {
    mealId: number;
    ingredientId: number;
    ingredient: Ingredient | undefined;
}
export interface UpdateMealIngredientResponse {
    meal: Meal | undefined;
}
export interface DeleteMealIngredientRequest {
    mealId: number;
    ingredientId: number;
}
export interface DeleteMealIngredientResponse {
    meal: Meal | undefined;
}
export interface DeleteMealRequest {
    mealId: number;
}
export interface DeleteMealResponse {
    message: string;
}
/** Recipe steps endpoints */
export interface GetStepsRequest {
    mealId: number;
}
export interface GetStepsResponse {
    steps: Step[];
}
export interface AddStepRequest {
    mealId: number;
    step: Step | undefined;
}
export interface AddStepResponse {
    step: Step | undefined;
}
export interface AddBulkStepsRequest {
    mealId: number;
    instructions: string[];
}
export interface AddBulkStepsResponse {
    steps: Step[];
}
export interface UpdateStepRequest {
    mealId: number;
    stepId: number;
    step: Step | undefined;
}
export interface UpdateStepResponse {
    step: Step | undefined;
}
export interface DeleteStepRequest {
    mealId: number;
    stepId: number;
}
export interface DeleteStepResponse {
    message: string;
}
export interface ReorderStepsRequest {
    mealId: number;
    stepIds: number[];
}
export interface ReorderStepsResponse {
    message: string;
}
export interface DeleteAllStepsRequest {
    mealId: number;
}
export interface DeleteAllStepsResponse {
    message: string;
}
/** Agent workflow endpoints */
export interface StartAgentWorkflowRequest {
    request: AgentStartRequest | undefined;
}
export interface StartAgentWorkflowResponse {
    response: AgentResponse | undefined;
}
export interface MessageAgentRequest {
    request: AgentMessageRequest | undefined;
}
export interface MessageAgentResponse {
    response: AgentResponse | undefined;
}
export interface GetWorkflowStatusRequest {
    threadId: string;
}
export interface GetWorkflowStatusResponse {
    status: WorkflowStatus | undefined;
}
export interface ListWorkflowsResponse {
    workflows: WorkflowStatus[];
}
export interface CancelWorkflowRequest {
    threadId: string;
}
export interface CancelWorkflowResponse {
    status: string;
}
/** Workflow management endpoints */
export interface GetWorkflowStateRequest {
    threadId: string;
}
export interface GetWorkflowStateResponse {
    plan: WeeklyMealPlan | undefined;
    shoppingList: ShoppingList | undefined;
    messages: Message[];
}
export interface AbandonWorkflowRequest {
    threadId: string;
}
export interface AbandonWorkflowResponse {
    message: string;
}
export interface AddMessageRequest {
    threadId: string;
    /** "user" or "agent" */
    sender: string;
    message: string;
}
export interface AddMessageResponse {
    message: string;
}
export interface UpdateSessionStateRequest {
    threadId: string;
    /** JSON string */
    mealPlan: string;
    /** JSON string */
    shoppingList: string;
    currentStep: string;
    status: string;
}
export interface UpdateSessionStateResponse {
    message: string;
}
/** LangGraph checkpoint persistence */
export interface AgentCheckpoint {
    channelValues: {
        [key: string]: Any;
    };
    next: string[];
    step: number;
}
export interface AgentCheckpoint_ChannelValuesEntry {
    key: string;
    value: Any | undefined;
}
export interface AgentCheckpointMetadata {
    source: string;
    step: number;
    writes: {
        [key: string]: Any;
    };
    additionalFields: {
        [key: string]: Any;
    };
}
export interface AgentCheckpointMetadata_WritesEntry {
    key: string;
    value: Any | undefined;
}
export interface AgentCheckpointMetadata_AdditionalFieldsEntry {
    key: string;
    value: Any | undefined;
}
export interface CheckpointTuple {
    checkpoint: AgentCheckpoint | undefined;
    metadata: AgentCheckpointMetadata | undefined;
}
export interface GetCheckpointRequest {
    threadId: string;
    /** optional - if empty, fetch latest */
    checkpointNs: string;
}
export interface GetCheckpointResponse {
    tuple: CheckpointTuple | undefined;
    found: boolean;
}
export interface PutCheckpointRequest {
    threadId: string;
    checkpointNs: string;
    workflowType: string;
    checkpoint: AgentCheckpoint | undefined;
    metadata: AgentCheckpointMetadata | undefined;
}
export interface PutCheckpointResponse {
    success: boolean;
    threadId: string;
    checkpointNs: string;
}
export interface ListCheckpointsRequest {
    limit: number;
    /** optional pagination */
    beforeThreadId: string;
}
export interface ListCheckpointsResponse {
    entries: CheckpointEntry[];
}
export interface CheckpointEntry {
    threadId: string;
    checkpointNs: string;
    tuple: CheckpointTuple | undefined;
}
/** Logging Service Messages */
export interface LogEntry {
    serviceName: string;
    /** DEBUG, INFO, WARN, ERROR */
    level: string;
    message: string;
    timestamp: Date | undefined;
    /** optional correlation ID */
    threadId: string;
    /** optional component/module name */
    component: string;
    /** structured fields */
    fields: {
        [key: string]: string;
    };
}
export interface LogEntry_FieldsEntry {
    key: string;
    value: string;
}
export interface LogRequest {
    entry: LogEntry | undefined;
}
export interface LogResponse {
    success: boolean;
    message: string;
}
export interface LogBatchRequest {
    entries: LogEntry[];
}
export interface LogBatchResponse {
    success: boolean;
    processed: number;
    errors: string[];
}
export declare const Ingredient: MessageFns<Ingredient>;
export declare const Step: MessageFns<Step>;
export declare const Meal: MessageFns<Meal>;
export declare const PlanDay: MessageFns<PlanDay>;
export declare const ShoppingListItem: MessageFns<ShoppingListItem>;
export declare const WeeklyMealPlan: MessageFns<WeeklyMealPlan>;
export declare const MealPlanEntry: MessageFns<MealPlanEntry>;
export declare const SaveMealPlanRequest: MessageFns<SaveMealPlanRequest>;
export declare const MealPlanIdentifier: MessageFns<MealPlanIdentifier>;
export declare const SaveCheckpointRequest: MessageFns<SaveCheckpointRequest>;
export declare const CheckpointResponse: MessageFns<CheckpointResponse>;
export declare const Message: MessageFns<Message>;
export declare const ShoppingList: MessageFns<ShoppingList>;
export declare const AgentStartRequest: MessageFns<AgentStartRequest>;
export declare const AgentFeedbackRequest: MessageFns<AgentFeedbackRequest>;
export declare const AgentResumeRequest: MessageFns<AgentResumeRequest>;
export declare const AgentMessageRequest: MessageFns<AgentMessageRequest>;
export declare const AgentResponse: MessageFns<AgentResponse>;
export declare const WorkflowStatus: MessageFns<WorkflowStatus>;
export declare const HealthCheckResponse: MessageFns<HealthCheckResponse>;
export declare const ReconnectResponse: MessageFns<ReconnectResponse>;
export declare const GetMealPlanResponse: MessageFns<GetMealPlanResponse>;
export declare const GenerateMealPlanResponse: MessageFns<GenerateMealPlanResponse>;
export declare const FinalizeMealPlanRequest: MessageFns<FinalizeMealPlanRequest>;
export declare const FinalizeMealPlanResponse: MessageFns<FinalizeMealPlanResponse>;
export declare const MealPlanICSResponse: MessageFns<MealPlanICSResponse>;
export declare const GetShoppingListRequest: MessageFns<GetShoppingListRequest>;
export declare const GetShoppingListResponse: MessageFns<GetShoppingListResponse>;
export declare const GetAllMealsRequest: MessageFns<GetAllMealsRequest>;
export declare const GetAllMealsResponse: MessageFns<GetAllMealsResponse>;
export declare const CreateMealRequest: MessageFns<CreateMealRequest>;
export declare const CreateMealResponse: MessageFns<CreateMealResponse>;
export declare const SwapMealRequest: MessageFns<SwapMealRequest>;
export declare const SwapMealResponse: MessageFns<SwapMealResponse>;
export declare const RemoveMealRequest: MessageFns<RemoveMealRequest>;
export declare const RemoveMealResponse: MessageFns<RemoveMealResponse>;
export declare const ReplaceMealRequest: MessageFns<ReplaceMealRequest>;
export declare const ReplaceMealResponse: MessageFns<ReplaceMealResponse>;
export declare const UpdateMealIngredientRequest: MessageFns<UpdateMealIngredientRequest>;
export declare const UpdateMealIngredientResponse: MessageFns<UpdateMealIngredientResponse>;
export declare const DeleteMealIngredientRequest: MessageFns<DeleteMealIngredientRequest>;
export declare const DeleteMealIngredientResponse: MessageFns<DeleteMealIngredientResponse>;
export declare const DeleteMealRequest: MessageFns<DeleteMealRequest>;
export declare const DeleteMealResponse: MessageFns<DeleteMealResponse>;
export declare const GetStepsRequest: MessageFns<GetStepsRequest>;
export declare const GetStepsResponse: MessageFns<GetStepsResponse>;
export declare const AddStepRequest: MessageFns<AddStepRequest>;
export declare const AddStepResponse: MessageFns<AddStepResponse>;
export declare const AddBulkStepsRequest: MessageFns<AddBulkStepsRequest>;
export declare const AddBulkStepsResponse: MessageFns<AddBulkStepsResponse>;
export declare const UpdateStepRequest: MessageFns<UpdateStepRequest>;
export declare const UpdateStepResponse: MessageFns<UpdateStepResponse>;
export declare const DeleteStepRequest: MessageFns<DeleteStepRequest>;
export declare const DeleteStepResponse: MessageFns<DeleteStepResponse>;
export declare const ReorderStepsRequest: MessageFns<ReorderStepsRequest>;
export declare const ReorderStepsResponse: MessageFns<ReorderStepsResponse>;
export declare const DeleteAllStepsRequest: MessageFns<DeleteAllStepsRequest>;
export declare const DeleteAllStepsResponse: MessageFns<DeleteAllStepsResponse>;
export declare const StartAgentWorkflowRequest: MessageFns<StartAgentWorkflowRequest>;
export declare const StartAgentWorkflowResponse: MessageFns<StartAgentWorkflowResponse>;
export declare const MessageAgentRequest: MessageFns<MessageAgentRequest>;
export declare const MessageAgentResponse: MessageFns<MessageAgentResponse>;
export declare const GetWorkflowStatusRequest: MessageFns<GetWorkflowStatusRequest>;
export declare const GetWorkflowStatusResponse: MessageFns<GetWorkflowStatusResponse>;
export declare const ListWorkflowsResponse: MessageFns<ListWorkflowsResponse>;
export declare const CancelWorkflowRequest: MessageFns<CancelWorkflowRequest>;
export declare const CancelWorkflowResponse: MessageFns<CancelWorkflowResponse>;
export declare const GetWorkflowStateRequest: MessageFns<GetWorkflowStateRequest>;
export declare const GetWorkflowStateResponse: MessageFns<GetWorkflowStateResponse>;
export declare const AbandonWorkflowRequest: MessageFns<AbandonWorkflowRequest>;
export declare const AbandonWorkflowResponse: MessageFns<AbandonWorkflowResponse>;
export declare const AddMessageRequest: MessageFns<AddMessageRequest>;
export declare const AddMessageResponse: MessageFns<AddMessageResponse>;
export declare const UpdateSessionStateRequest: MessageFns<UpdateSessionStateRequest>;
export declare const UpdateSessionStateResponse: MessageFns<UpdateSessionStateResponse>;
export declare const AgentCheckpoint: MessageFns<AgentCheckpoint>;
export declare const AgentCheckpoint_ChannelValuesEntry: MessageFns<AgentCheckpoint_ChannelValuesEntry>;
export declare const AgentCheckpointMetadata: MessageFns<AgentCheckpointMetadata>;
export declare const AgentCheckpointMetadata_WritesEntry: MessageFns<AgentCheckpointMetadata_WritesEntry>;
export declare const AgentCheckpointMetadata_AdditionalFieldsEntry: MessageFns<AgentCheckpointMetadata_AdditionalFieldsEntry>;
export declare const CheckpointTuple: MessageFns<CheckpointTuple>;
export declare const GetCheckpointRequest: MessageFns<GetCheckpointRequest>;
export declare const GetCheckpointResponse: MessageFns<GetCheckpointResponse>;
export declare const PutCheckpointRequest: MessageFns<PutCheckpointRequest>;
export declare const PutCheckpointResponse: MessageFns<PutCheckpointResponse>;
export declare const ListCheckpointsRequest: MessageFns<ListCheckpointsRequest>;
export declare const ListCheckpointsResponse: MessageFns<ListCheckpointsResponse>;
export declare const CheckpointEntry: MessageFns<CheckpointEntry>;
export declare const LogEntry: MessageFns<LogEntry>;
export declare const LogEntry_FieldsEntry: MessageFns<LogEntry_FieldsEntry>;
export declare const LogRequest: MessageFns<LogRequest>;
export declare const LogResponse: MessageFns<LogResponse>;
export declare const LogBatchRequest: MessageFns<LogBatchRequest>;
export declare const LogBatchResponse: MessageFns<LogBatchResponse>;
/** Service definition */
export interface MealPlannerAPI {
    /** Health endpoints */
    HealthCheck(request: Empty): Promise<HealthCheckResponse>;
    Reconnect(request: Empty): Promise<ReconnectResponse>;
    /** Meal plan endpoints */
    GetMealPlan(request: Empty): Promise<GetMealPlanResponse>;
    GenerateMealPlan(request: Empty): Promise<GenerateMealPlanResponse>;
    FinalizeMealPlan(request: FinalizeMealPlanRequest): Promise<FinalizeMealPlanResponse>;
    GetMealPlanICS(request: Empty): Promise<MealPlanICSResponse>;
    /** Shopping list endpoints */
    GetShoppingList(request: GetShoppingListRequest): Promise<GetShoppingListResponse>;
    /** Meals endpoints */
    GetAllMeals(request: GetAllMealsRequest): Promise<GetAllMealsResponse>;
    CreateMeal(request: CreateMealRequest): Promise<CreateMealResponse>;
    SwapMeal(request: SwapMealRequest): Promise<SwapMealResponse>;
    RemoveMeal(request: RemoveMealRequest): Promise<RemoveMealResponse>;
    ReplaceMeal(request: ReplaceMealRequest): Promise<ReplaceMealResponse>;
    UpdateMealIngredient(request: UpdateMealIngredientRequest): Promise<UpdateMealIngredientResponse>;
    DeleteMealIngredient(request: DeleteMealIngredientRequest): Promise<DeleteMealIngredientResponse>;
    DeleteMeal(request: DeleteMealRequest): Promise<DeleteMealResponse>;
    /** Recipe steps endpoints */
    GetSteps(request: GetStepsRequest): Promise<GetStepsResponse>;
    AddStep(request: AddStepRequest): Promise<AddStepResponse>;
    AddBulkSteps(request: AddBulkStepsRequest): Promise<AddBulkStepsResponse>;
    UpdateStep(request: UpdateStepRequest): Promise<UpdateStepResponse>;
    DeleteStep(request: DeleteStepRequest): Promise<DeleteStepResponse>;
    ReorderSteps(request: ReorderStepsRequest): Promise<ReorderStepsResponse>;
    DeleteAllSteps(request: DeleteAllStepsRequest): Promise<DeleteAllStepsResponse>;
    /** Agent workflow endpoints */
    StartAgentWorkflow(request: StartAgentWorkflowRequest): Promise<StartAgentWorkflowResponse>;
    MessageAgent(request: MessageAgentRequest): Promise<MessageAgentResponse>;
    GetWorkflowStatus(request: GetWorkflowStatusRequest): Promise<GetWorkflowStatusResponse>;
    ListWorkflows(request: Empty): Promise<ListWorkflowsResponse>;
    CancelWorkflow(request: CancelWorkflowRequest): Promise<CancelWorkflowResponse>;
    /** Workflow management endpoints */
    GetWorkflowState(request: GetWorkflowStateRequest): Promise<GetWorkflowStateResponse>;
    AbandonWorkflow(request: AbandonWorkflowRequest): Promise<AbandonWorkflowResponse>;
    AddMessage(request: AddMessageRequest): Promise<AddMessageResponse>;
    UpdateSessionState(request: UpdateSessionStateRequest): Promise<UpdateSessionStateResponse>;
    /** Checkpoint persistence endpoints */
    GetCheckpoint(request: GetCheckpointRequest): Promise<GetCheckpointResponse>;
    PutCheckpoint(request: PutCheckpointRequest): Promise<PutCheckpointResponse>;
    ListCheckpoints(request: ListCheckpointsRequest): Promise<ListCheckpointsResponse>;
    /** Logging Service endpoints */
    Log(request: LogRequest): Promise<LogResponse>;
    LogBatch(request: LogBatchRequest): Promise<LogBatchResponse>;
}
export declare const MealPlannerAPIServiceName = "mealplanner.api.MealPlannerAPI";
export declare class MealPlannerAPIClientImpl implements MealPlannerAPI {
    private readonly rpc;
    private readonly service;
    constructor(rpc: Rpc, opts?: {
        service?: string;
    });
    HealthCheck(request: Empty): Promise<HealthCheckResponse>;
    Reconnect(request: Empty): Promise<ReconnectResponse>;
    GetMealPlan(request: Empty): Promise<GetMealPlanResponse>;
    GenerateMealPlan(request: Empty): Promise<GenerateMealPlanResponse>;
    FinalizeMealPlan(request: FinalizeMealPlanRequest): Promise<FinalizeMealPlanResponse>;
    GetMealPlanICS(request: Empty): Promise<MealPlanICSResponse>;
    GetShoppingList(request: GetShoppingListRequest): Promise<GetShoppingListResponse>;
    GetAllMeals(request: GetAllMealsRequest): Promise<GetAllMealsResponse>;
    CreateMeal(request: CreateMealRequest): Promise<CreateMealResponse>;
    SwapMeal(request: SwapMealRequest): Promise<SwapMealResponse>;
    RemoveMeal(request: RemoveMealRequest): Promise<RemoveMealResponse>;
    ReplaceMeal(request: ReplaceMealRequest): Promise<ReplaceMealResponse>;
    UpdateMealIngredient(request: UpdateMealIngredientRequest): Promise<UpdateMealIngredientResponse>;
    DeleteMealIngredient(request: DeleteMealIngredientRequest): Promise<DeleteMealIngredientResponse>;
    DeleteMeal(request: DeleteMealRequest): Promise<DeleteMealResponse>;
    GetSteps(request: GetStepsRequest): Promise<GetStepsResponse>;
    AddStep(request: AddStepRequest): Promise<AddStepResponse>;
    AddBulkSteps(request: AddBulkStepsRequest): Promise<AddBulkStepsResponse>;
    UpdateStep(request: UpdateStepRequest): Promise<UpdateStepResponse>;
    DeleteStep(request: DeleteStepRequest): Promise<DeleteStepResponse>;
    ReorderSteps(request: ReorderStepsRequest): Promise<ReorderStepsResponse>;
    DeleteAllSteps(request: DeleteAllStepsRequest): Promise<DeleteAllStepsResponse>;
    StartAgentWorkflow(request: StartAgentWorkflowRequest): Promise<StartAgentWorkflowResponse>;
    MessageAgent(request: MessageAgentRequest): Promise<MessageAgentResponse>;
    GetWorkflowStatus(request: GetWorkflowStatusRequest): Promise<GetWorkflowStatusResponse>;
    ListWorkflows(request: Empty): Promise<ListWorkflowsResponse>;
    CancelWorkflow(request: CancelWorkflowRequest): Promise<CancelWorkflowResponse>;
    GetWorkflowState(request: GetWorkflowStateRequest): Promise<GetWorkflowStateResponse>;
    AbandonWorkflow(request: AbandonWorkflowRequest): Promise<AbandonWorkflowResponse>;
    AddMessage(request: AddMessageRequest): Promise<AddMessageResponse>;
    UpdateSessionState(request: UpdateSessionStateRequest): Promise<UpdateSessionStateResponse>;
    GetCheckpoint(request: GetCheckpointRequest): Promise<GetCheckpointResponse>;
    PutCheckpoint(request: PutCheckpointRequest): Promise<PutCheckpointResponse>;
    ListCheckpoints(request: ListCheckpointsRequest): Promise<ListCheckpointsResponse>;
    Log(request: LogRequest): Promise<LogResponse>;
    LogBatch(request: LogBatchRequest): Promise<LogBatchResponse>;
}
interface Rpc {
    request(service: string, method: string, data: Uint8Array): Promise<Uint8Array>;
}
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
export type DeepPartial<T> = T extends Builtin ? T : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P : P & {
    [K in keyof P]: Exact<P[K], I[K]>;
} & {
    [K in Exclude<keyof I, KeysOfUnion<P>>]: never;
};
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
    fromJSON(object: any): T;
    toJSON(message: T): unknown;
    create<I extends Exact<DeepPartial<T>, I>>(base?: I): T;
    fromPartial<I extends Exact<DeepPartial<T>, I>>(object: I): T;
}
export {};
