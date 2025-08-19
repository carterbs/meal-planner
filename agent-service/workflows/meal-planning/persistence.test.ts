import { saveCheckpoint } from './persistence';
import { DbCheckpointSaver } from '../../shared/dbCheckpointer';
import { AgentCheckpoint, AgentCheckpointMetadata } from '@mealplanner/generated';
import { TestMockFactory } from '../../tests/test-utils';

jest.mock('../../logging');

describe('persistence.saveCheckpoint', () => {
    it('calls checkpointer.put with checkpoint and metadata', async () => {
        const checkpointer = ({ put: jest.fn().mockResolvedValue(undefined) } as unknown) as jest.Mocked<DbCheckpointSaver>;
        const config = TestMockFactory.createMockExtendedRunnableConfig();
        const state = TestMockFactory.createMockMealPlanningState({});
        await saveCheckpoint(checkpointer, config as any, state as any);
        expect(checkpointer.put).toHaveBeenCalledWith(
            config,
            expect.any(AgentCheckpoint),
            expect.any(AgentCheckpointMetadata),
        );
    });

    it('throws when mealPlan serialization fails', async () => {
        const checkpointer = ({ put: jest.fn() } as unknown) as jest.Mocked<DbCheckpointSaver>;
        const config = TestMockFactory.createMockExtendedRunnableConfig();
        const state = TestMockFactory.createMockMealPlanningState({});
        // Force toJson to throw
        (state.mealPlan as any).toJson = jest.fn(() => {
            throw new Error('Serialization error');
        });
        await expect(saveCheckpoint(checkpointer, config as any, state as any)).rejects.toThrow('Serialization error');
    });
});


