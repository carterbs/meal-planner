import { WorkflowType } from '../shared/types';
import { WorkflowFactory, BaseWorkflow } from '../registry';
import { PostgresCheckpointSaver } from '../shared/checkpointer';
import { MealPlanningWorkflow } from './meal-planning';

export class MealPlanningWorkflowFactory implements WorkflowFactory {
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