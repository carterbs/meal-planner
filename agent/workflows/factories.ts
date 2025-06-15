import { WorkflowType, MealPlanningState } from '../shared/types.js';
import { WorkflowFactory, BaseWorkflow } from '../registry.js';
import { PostgresCheckpointSaver } from '../shared/checkpointer.js';
import { MealPlanningWorkflow } from './meal-planning.js';

export class MealPlanningWorkflowFactory implements WorkflowFactory<MealPlanningState> {
  async create(checkpointer: PostgresCheckpointSaver): Promise<BaseWorkflow> {
    return new MealPlanningWorkflow(checkpointer);
  }

  getType(): WorkflowType {
    return WorkflowType.MEAL_PLANNING;
  }
}

// Export all factories
export const workflowFactories = [
  new MealPlanningWorkflowFactory(),
  // Future factories will be added here:
  // new RecipeManagementWorkflowFactory(),
  // new IngredientManagementWorkflowFactory(),
];