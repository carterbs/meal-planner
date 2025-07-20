import { WorkflowType } from '../shared/types';
import { WorkflowFactory, BaseWorkflow } from '../registry';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
import { MealPlanningWorkflow } from './meal-planning';
export class MealPlanningWorkflowFactory implements WorkflowFactory {
  async create(checkpointer: DbCheckpointSaver): Promise<BaseWorkflow> {
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
