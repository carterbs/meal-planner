import { z } from 'zod';

// Core workflow types
export enum WorkflowType {
  MEAL_PLANNING = 'meal_planning',
  RECIPE_MANAGEMENT = 'recipe_management',
  INGREDIENT_MANAGEMENT = 'ingredient_management'
}

// Base workflow state interface
export interface BaseWorkflowState {
  threadId: string;
  workflow_type: WorkflowType;
  participants: string[];
  created_at: Date;
  updated_at: Date;
  current_step: string;
}

// Meal planning workflow steps
export enum MealPlanningStep {
  INITIATE = 'initiate',
  GENERATE_PLAN = 'generate_plan',
  OPTIMIZE_PLAN = 'optimize_plan',
  PRESENT_PLAN = 'present_plan',
  AWAIT_FEEDBACK = 'await_feedback',
  APPLY_FEEDBACK = 'apply_feedback', // NEW: for LLM-driven feedback application
  PROCESS_FEEDBACK = 'process_feedback',
  FINALIZE_PLAN = 'finalize_plan',
  GENERATE_SHOPPING_LIST = 'generate_shopping_list',
  COMPLETE = 'complete'
}

// Recipe management workflow steps
export enum RecipeManagementStep {
  INITIATE = 'initiate',
  VALIDATE_RECIPE = 'validate_recipe',
  SAVE_RECIPE = 'save_recipe',  
  CONFIRM = 'confirm',
  COMPLETE = 'complete'
}

// Ingredient management workflow steps
export enum IngredientManagementStep {
  INITIATE = 'initiate',
  EXAMINE_INGREDIENTS = 'examine_ingredients',
  PRESENT_CHANGES = 'present_changes',
  AWAIT_FEEDBACK = 'await_feedback',
  CONFIRM = 'confirm', 
  COMPLETE = 'complete'
}

// Data structures

export interface FeedbackEntry {
  from: string; // 'brad' or 'shannon'
  message: string;
  timestamp: Date;
  meal_plan_version: number;
}

export interface ShoppingItem {
  ingredient: string;
  quantity: string;
  category?: string;
}

export interface RecipeData {
  id?: number;
  name: string;
  ingredients: string[];
  steps: string[];
  meal_type: string;
  effort: number;
}

export interface IngredientData {
  id?: number;
  name: string;
  category?: string;
  properties?: Record<string, any>;
}

export interface SubstitutionData {
  from_ingredient: string;
  to_ingredient: string;
  ratio?: number;
  notes?: string;
}

// Meal structure (reuse from existing agent)
export interface InternalMeal {
  id: number;
  name: string;
  effort: number;
  hasRedMeat: boolean;
}

export interface WeeklyMealPlan {
  id?: number;
  days: Array<{
    dayIndex: number;
    mealType: string;
    meal: InternalMeal | null;
  }>;
}

// Workflow state interfaces
export interface MealPlanningState extends BaseWorkflowState {
  workflow_type: WorkflowType.MEAL_PLANNING;
  meal_plan: WeeklyMealPlan | null;
  feedback_history: FeedbackEntry[];
  iteration_count: number;
  shopping_list: ShoppingItem[] | null;
  is_finalized: boolean;
  current_step: MealPlanningStep;
  shopping_list_formatted?: string;
  user_message?: string; // LLM-generated message about changes made
  last_feedback_applied_at?: string;
  feedback_to_apply?: FeedbackEntry[];
  _error?: string; // For tracking errors during workflow execution
}

export interface RecipeManagementState extends BaseWorkflowState {
  workflow_type: WorkflowType.RECIPE_MANAGEMENT;
  recipe_action: 'create' | 'update' | 'delete';
  recipe_data: RecipeData | null;
  validation_errors: string[];
  current_step: RecipeManagementStep;
}

export interface IngredientManagementState extends BaseWorkflowState {
  workflow_type: WorkflowType.INGREDIENT_MANAGEMENT;
  ingredient_action: 'create' | 'update' | 'delete' | 'substitute';
  ingredient_data: IngredientData | null;
  substitution_data: SubstitutionData | null;
  validation_errors: string[];
  current_step: IngredientManagementStep;
}

// Union type for all workflow states
export type WorkflowState = MealPlanningState | RecipeManagementState | IngredientManagementState;

// Zod schemas for validation
export const BaseWorkflowStateSchema = z.object({
  threadId: z.string(),
  workflow_type: z.nativeEnum(WorkflowType),
  participants: z.array(z.string()),
  created_at: z.date(),
  updated_at: z.date(),
  current_step: z.string()
});

export const MealPlanningStateSchema = BaseWorkflowStateSchema.extend({
  workflow_type: z.literal(WorkflowType.MEAL_PLANNING),
  meal_plan: z.object({
    id: z.number().optional(),
    days: z.array(z.object({
      dayIndex: z.number(),
      mealType: z.string(),
      meal: z.object({
        id: z.number(),
        name: z.string(),
        effort: z.number(),
        hasRedMeat: z.boolean()
      }).nullable()
    }))
  }).nullable(),
  feedback_history: z.array(z.object({
    from: z.string(),
    message: z.string(),
    timestamp: z.date(),
    meal_plan_version: z.number()
  })),
  iteration_count: z.number(),
  shopping_list: z.array(z.object({
    ingredient: z.string(),
    quantity: z.string(),
    category: z.string().optional()
  })).nullable(),
  is_finalized: z.boolean(),
  current_step: z.nativeEnum(MealPlanningStep),
  shopping_list_formatted: z.string().optional(),
  _error: z.string().optional()
});

export const RecipeManagementStateSchema = BaseWorkflowStateSchema.extend({
  workflow_type: z.literal(WorkflowType.RECIPE_MANAGEMENT),
  recipe_action: z.enum(['create', 'update', 'delete']),
  recipe_data: z.object({
    id: z.number().optional(),
    name: z.string(),
    ingredients: z.array(z.string()),
    steps: z.array(z.string()),
    meal_type: z.string(),
    effort: z.number()
  }).nullable(),
  validation_errors: z.array(z.string()),
  current_step: z.nativeEnum(RecipeManagementStep)
});

export const IngredientManagementStateSchema = BaseWorkflowStateSchema.extend({
  workflow_type: z.literal(WorkflowType.INGREDIENT_MANAGEMENT),
  ingredient_action: z.enum(['create', 'update', 'delete', 'substitute']),
  ingredient_data: z.object({
    id: z.number().optional(),
    name: z.string(),
    category: z.string().optional(),
    properties: z.record(z.any()).optional()
  }).nullable(),
  substitution_data: z.object({
    from_ingredient: z.string(),
    to_ingredient: z.string(),
    ratio: z.number().optional(),
    notes: z.string().optional()
  }).nullable(),
  validation_errors: z.array(z.string()),
  current_step: z.nativeEnum(IngredientManagementStep)
});

// Constants
export const DAY_NAMES = [
  'Sunday',
  'Monday', 
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const;

export const VALIDATION_CRITERIA = {
  maxConsecutiveHighEffort: 2,
  maxRedMeatPerWeek: 3,
} as const;