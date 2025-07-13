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
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.LoggingService.LogBatch
         */
        readonly logBatch: {
            readonly name: "LogBatch";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
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
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.Reconnect
         */
        readonly reconnect: {
            readonly name: "Reconnect";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * Meal plan endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetMealPlan
         */
        readonly getMealPlan: {
            readonly name: "GetMealPlan";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.GenerateMealPlan
         */
        readonly generateMealPlan: {
            readonly name: "GenerateMealPlan";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.FinalizeMealPlan
         */
        readonly finalizeMealPlan: {
            readonly name: "FinalizeMealPlan";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetMealPlanICS
         */
        readonly getMealPlanICS: {
            readonly name: "GetMealPlanICS";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * Shopping list endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetShoppingList
         */
        readonly getShoppingList: {
            readonly name: "GetShoppingList";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * Meals endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetAllMeals
         */
        readonly getAllMeals: {
            readonly name: "GetAllMeals";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.CreateMeal
         */
        readonly createMeal: {
            readonly name: "CreateMeal";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.SwapMeal
         */
        readonly swapMeal: {
            readonly name: "SwapMeal";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.RemoveMeal
         */
        readonly removeMeal: {
            readonly name: "RemoveMeal";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.ReplaceMeal
         */
        readonly replaceMeal: {
            readonly name: "ReplaceMeal";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateMealIngredient
         */
        readonly updateMealIngredient: {
            readonly name: "UpdateMealIngredient";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteMealIngredient
         */
        readonly deleteMealIngredient: {
            readonly name: "DeleteMealIngredient";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteMeal
         */
        readonly deleteMeal: {
            readonly name: "DeleteMeal";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * Recipe steps endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetSteps
         */
        readonly getSteps: {
            readonly name: "GetSteps";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.AddStep
         */
        readonly addStep: {
            readonly name: "AddStep";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.AddBulkSteps
         */
        readonly addBulkSteps: {
            readonly name: "AddBulkSteps";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateStep
         */
        readonly updateStep: {
            readonly name: "UpdateStep";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteStep
         */
        readonly deleteStep: {
            readonly name: "DeleteStep";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.ReorderSteps
         */
        readonly reorderSteps: {
            readonly name: "ReorderSteps";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.DeleteAllSteps
         */
        readonly deleteAllSteps: {
            readonly name: "DeleteAllSteps";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * Agent workflow endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.StartAgentWorkflow
         */
        readonly startAgentWorkflow: {
            readonly name: "StartAgentWorkflow";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.MessageAgent
         */
        readonly messageAgent: {
            readonly name: "MessageAgent";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetWorkflowStatus
         */
        readonly getWorkflowStatus: {
            readonly name: "GetWorkflowStatus";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.ListWorkflows
         */
        readonly listWorkflows: {
            readonly name: "ListWorkflows";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.CancelWorkflow
         */
        readonly cancelWorkflow: {
            readonly name: "CancelWorkflow";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * Workflow management endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetWorkflowState
         */
        readonly getWorkflowState: {
            readonly name: "GetWorkflowState";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.AbandonWorkflow
         */
        readonly abandonWorkflow: {
            readonly name: "AbandonWorkflow";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.AddMessage
         */
        readonly addMessage: {
            readonly name: "AddMessage";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.UpdateSessionState
         */
        readonly updateSessionState: {
            readonly name: "UpdateSessionState";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * Checkpoint persistence endpoints
         *
         * @generated from rpc mealplanner.api.MealPlannerAPI.GetCheckpoint
         */
        readonly getCheckpoint: {
            readonly name: "GetCheckpoint";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.PutCheckpoint
         */
        readonly putCheckpoint: {
            readonly name: "PutCheckpoint";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
        /**
         * @generated from rpc mealplanner.api.MealPlannerAPI.ListCheckpoints
         */
        readonly listCheckpoints: {
            readonly name: "ListCheckpoints";
            readonly I: any;
            readonly O: any;
            readonly kind: any;
        };
    };
};
