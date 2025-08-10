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
    // Force serialization to surface errors early (mirrors previous behavior)
    const checkpoint = new AgentCheckpoint({ state, next: [], step: 0 });
    // Touch nested structures that may throw in toJson in tests
    if ((state as any)?.mealPlan?.toJson) {
        (state as any).mealPlan.toJson();
    }
    const metadata = new AgentCheckpointMetadata({ source: 'workflow', step: 0 });
    await checkpointer.put(config, checkpoint, metadata);
}


