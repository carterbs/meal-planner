import { AgentCheckpoint, AgentCheckpointMetadata } from '@mealplanner/generated';
import type { ExtendedRunnableConfig, MealPlanningState } from '../../shared/types';
import { DbCheckpointSaver } from '../../shared/dbCheckpointer';
import { infoLog } from '../../logging';

export async function saveCheckpoint(
    checkpointer: DbCheckpointSaver,
    config: ExtendedRunnableConfig,
    state: MealPlanningState,
): Promise<void> {
    await infoLog('MealPlanningPersistence.saveCheckpoint called');
    // If mealPlan serialization fails, propagate the error to the caller/tests
    if (state.mealPlan) {
        // This will invoke any overridden toJson implementation and surface serialization issues
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        void state.mealPlan.toJson();
    }
    const checkpoint = new AgentCheckpoint({ state, next: [], step: 0 });
    const metadata = new AgentCheckpointMetadata({ source: 'workflow', step: 0 });
    await checkpointer.put(config, checkpoint, metadata);
}


