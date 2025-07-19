// UI types - plain TypeScript interfaces (no proto dependencies)
export interface Ingredient {
  id?: number;
  mealId?: number;
  quantity: number;
  unit: string;
  name: string;
}

export interface Step {
  id?: number;
  mealId?: number;
  stepNumber?: number;
  instruction: string;
}

export interface ShoppingListItem {
  ingredient: string;
  quantity: string;
  category: string;
}

export interface Meal {
  id?: number;
  name: string;
  effort: number;
  hasRedMeat: boolean;
  url: string;
  mealType: string;
  ingredients: Ingredient[];
  steps: Step[];
}

// Re-export remaining types from proto-generated package
export type {
  WeeklyMealPlan,
  AgentStartRequest,
  AgentFeedbackRequest,
  AgentResumeRequest,
  AgentMessageRequest,
  AgentResponse,
  WorkflowStatus,
  HealthCheckResponse,
  ReconnectResponse,
  GetMealPlanResponse,
  GenerateMealPlanResponse,
  FinalizeMealPlanRequest,
  FinalizeMealPlanResponse,
  MealPlanICSResponse,
  GetShoppingListRequest,
  GetShoppingListResponse,
  GetAllMealsRequest,
  GetAllMealsResponse,
  CreateMealRequest,
  CreateMealResponse,
  SwapMealRequest,
  SwapMealResponse,
  ReplaceMealRequest,
  ReplaceMealResponse,
  UpdateMealIngredientRequest,
  UpdateMealIngredientResponse,
  DeleteMealIngredientRequest,
  DeleteMealIngredientResponse,
  DeleteMealRequest,
  DeleteMealResponse,
  GetStepsRequest,
  GetStepsResponse,
  AddStepRequest,
  AddStepResponse,
  AddBulkStepsRequest,
  AddBulkStepsResponse,
  UpdateStepRequest,
  UpdateStepResponse,
  DeleteStepRequest,
  DeleteStepResponse,
  ReorderStepsRequest,
  ReorderStepsResponse,
  DeleteAllStepsRequest,
  DeleteAllStepsResponse,
  StartAgentWorkflowRequest,
  StartAgentWorkflowResponse,
  MessageAgentRequest,
  MessageAgentResponse,
  GetWorkflowStatusRequest,
  GetWorkflowStatusResponse,
  ListWorkflowsResponse,
  CancelWorkflowRequest,
  CancelWorkflowResponse,
  GetWorkflowStateRequest,
  GetWorkflowStateResponse,
  AbandonWorkflowRequest,
  AbandonWorkflowResponse,
  AddMessageRequest,
  AddMessageResponse,
  UpdateSessionStateRequest,
  UpdateSessionStateResponse,
} from '@mealplanner/generated';
