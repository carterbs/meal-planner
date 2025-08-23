import { AbandonWorkflowRequest, AbandonWorkflowResponse, AddBulkStepsRequest, AddBulkStepsResponse, AddMessageRequest, AddMessageResponse, AddStepRequest, AddStepResponse, CancelWorkflowRequest, CancelWorkflowResponse, CreateMealIngredientRequest, CreateMealIngredientResponse, CreateMealRequest, CreateMealResponse, DeleteAllStepsRequest, DeleteAllStepsResponse, DeleteMealIngredientRequest, DeleteMealIngredientResponse, DeleteMealRequest, DeleteMealResponse, DeleteStepRequest, DeleteStepResponse, FinalizeMealPlanRequest, FinalizeMealPlanResponse, GenerateMealPlanResponse, GetAllMealsRequest, GetAllMealsResponse, GetCheckpointRequest, GetCheckpointResponse, GetMealPlanResponse, GetMessagesRequest, GetMessagesResponse, GetShoppingListRequest, GetShoppingListResponse, GetStepsRequest, GetStepsResponse, GetWorkflowStateRequest, GetWorkflowStateResponse, GetWorkflowStatusRequest, GetWorkflowStatusResponse, HealthCheckResponse, ListCheckpointsRequest, ListCheckpointsResponse, ListWorkflowsResponse, LogBatchRequest, LogBatchResponse, LogRequest, LogResponse, PutCheckpointRequest, PutCheckpointResponse, ReorderStepsRequest, ReorderStepsResponse, ReplaceMealRequest, ReplaceMealResponse, SwapMealRequest, SwapMealResponse, UpdateMealIngredientRequest, UpdateMealIngredientResponse, UpdateMealRequest, UpdateMealResponse, UpdateStepRequest, UpdateStepResponse } from "./api_pb.js";
import { Empty, MethodKind } from "@bufbuild/protobuf";
/**
 * Logging Service definition
 *
 * @generated from service mealplanner.api.LoggingService
 */
export declare const LoggingService: {
    readonly typeName: "mealplanner.api.LoggingService";
    readonly methods: {
        /**
         * @generated from rpc mealplanner.api.LoggingService.Log
         */
        readonly log: {
            readonly name: "Log";
            readonly I: typeof LogRequest;
            readonly O: typeof LogResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.LoggingService.LogBatch
         */
        readonly logBatch: {
            readonly name: "LogBatch";
            readonly I: typeof LogBatchRequest;
            readonly O: typeof LogBatchResponse;
            readonly kind: MethodKind.Unary;
        };
    };
};
/**
 * Service definition
 *
 * @generated from service mealplanner.api.MealPlannerAPI
 */
export declare const MealPlannerAPI: {
    readonly typeName: "mealplanner.api.MealPlannerAPI";
    readonly methods: {
        /**
         * Health endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.HealthCheck
         */
        readonly healthCheck: {
            readonly name: "HealthCheck";
            readonly I: typeof Empty;
            readonly O: typeof HealthCheckResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Meal plan endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetMealPlan
         */
        readonly getMealPlan: {
            readonly name: "GetMealPlan";
            readonly I: typeof Empty;
            readonly O: typeof GetMealPlanResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.GenerateMealPlan
         */
        readonly generateMealPlan: {
            readonly name: "GenerateMealPlan";
            readonly I: typeof Empty;
            readonly O: typeof GenerateMealPlanResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.FinalizeMealPlan
         */
        readonly finalizeMealPlan: {
            readonly name: "FinalizeMealPlan";
            readonly I: typeof FinalizeMealPlanRequest;
            readonly O: typeof FinalizeMealPlanResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Shopping list endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetShoppingList
         */
        readonly getShoppingList: {
            readonly name: "GetShoppingList";
            readonly I: typeof GetShoppingListRequest;
            readonly O: typeof GetShoppingListResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Meals endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetAllMeals
         */
        readonly getAllMeals: {
            readonly name: "GetAllMeals";
            readonly I: typeof GetAllMealsRequest;
            readonly O: typeof GetAllMealsResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.CreateMeal
         */
        readonly createMeal: {
            readonly name: "CreateMeal";
            readonly I: typeof CreateMealRequest;
            readonly O: typeof CreateMealResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateMeal
         */
        readonly updateMeal: {
            readonly name: "UpdateMeal";
            readonly I: typeof UpdateMealRequest;
            readonly O: typeof UpdateMealResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.SwapMeal
         */
        readonly swapMeal: {
            readonly name: "SwapMeal";
            readonly I: typeof SwapMealRequest;
            readonly O: typeof SwapMealResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.ReplaceMeal
         */
        readonly replaceMeal: {
            readonly name: "ReplaceMeal";
            readonly I: typeof ReplaceMealRequest;
            readonly O: typeof ReplaceMealResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.CreateMealIngredient
         */
        readonly createMealIngredient: {
            readonly name: "CreateMealIngredient";
            readonly I: typeof CreateMealIngredientRequest;
            readonly O: typeof CreateMealIngredientResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateMealIngredient
         */
        readonly updateMealIngredient: {
            readonly name: "UpdateMealIngredient";
            readonly I: typeof UpdateMealIngredientRequest;
            readonly O: typeof UpdateMealIngredientResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteMealIngredient
         */
        readonly deleteMealIngredient: {
            readonly name: "DeleteMealIngredient";
            readonly I: typeof DeleteMealIngredientRequest;
            readonly O: typeof DeleteMealIngredientResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteMeal
         */
        readonly deleteMeal: {
            readonly name: "DeleteMeal";
            readonly I: typeof DeleteMealRequest;
            readonly O: typeof DeleteMealResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Recipe steps endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetSteps
         */
        readonly getSteps: {
            readonly name: "GetSteps";
            readonly I: typeof GetStepsRequest;
            readonly O: typeof GetStepsResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.AddStep
         */
        readonly addStep: {
            readonly name: "AddStep";
            readonly I: typeof AddStepRequest;
            readonly O: typeof AddStepResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.AddBulkSteps
         */
        readonly addBulkSteps: {
            readonly name: "AddBulkSteps";
            readonly I: typeof AddBulkStepsRequest;
            readonly O: typeof AddBulkStepsResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateStep
         */
        readonly updateStep: {
            readonly name: "UpdateStep";
            readonly I: typeof UpdateStepRequest;
            readonly O: typeof UpdateStepResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteStep
         */
        readonly deleteStep: {
            readonly name: "DeleteStep";
            readonly I: typeof DeleteStepRequest;
            readonly O: typeof DeleteStepResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.ReorderSteps
         */
        readonly reorderSteps: {
            readonly name: "ReorderSteps";
            readonly I: typeof ReorderStepsRequest;
            readonly O: typeof ReorderStepsResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteAllSteps
         */
        readonly deleteAllSteps: {
            readonly name: "DeleteAllSteps";
            readonly I: typeof DeleteAllStepsRequest;
            readonly O: typeof DeleteAllStepsResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Agent workflow endpoints handled by the agent service
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetWorkflowStatus
         */
        readonly getWorkflowStatus: {
            readonly name: "GetWorkflowStatus";
            readonly I: typeof GetWorkflowStatusRequest;
            readonly O: typeof GetWorkflowStatusResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.ListWorkflows
         */
        readonly listWorkflows: {
            readonly name: "ListWorkflows";
            readonly I: typeof Empty;
            readonly O: typeof ListWorkflowsResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.CancelWorkflow
         */
        readonly cancelWorkflow: {
            readonly name: "CancelWorkflow";
            readonly I: typeof CancelWorkflowRequest;
            readonly O: typeof CancelWorkflowResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Workflow management endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetWorkflowState
         */
        readonly getWorkflowState: {
            readonly name: "GetWorkflowState";
            readonly I: typeof GetWorkflowStateRequest;
            readonly O: typeof GetWorkflowStateResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.AbandonWorkflow
         */
        readonly abandonWorkflow: {
            readonly name: "AbandonWorkflow";
            readonly I: typeof AbandonWorkflowRequest;
            readonly O: typeof AbandonWorkflowResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.AddMessage
         */
        readonly addMessage: {
            readonly name: "AddMessage";
            readonly I: typeof AddMessageRequest;
            readonly O: typeof AddMessageResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetMessages
         */
        readonly getMessages: {
            readonly name: "GetMessages";
            readonly I: typeof GetMessagesRequest;
            readonly O: typeof GetMessagesResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * Checkpoint persistence endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetCheckpoint
         */
        readonly getCheckpoint: {
            readonly name: "GetCheckpoint";
            readonly I: typeof GetCheckpointRequest;
            readonly O: typeof GetCheckpointResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.PutCheckpoint
         */
        readonly putCheckpoint: {
            readonly name: "PutCheckpoint";
            readonly I: typeof PutCheckpointRequest;
            readonly O: typeof PutCheckpointResponse;
            readonly kind: MethodKind.Unary;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.ListCheckpoints
         */
        readonly listCheckpoints: {
            readonly name: "ListCheckpoints";
            readonly I: typeof ListCheckpointsRequest;
            readonly O: typeof ListCheckpointsResponse;
            readonly kind: MethodKind.Unary;
        };
    };
};
