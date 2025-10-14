import { cloneAndUpdateState, deserializeMealPlanFromCheckpoint } from './state';
import { TestMockFactory } from '../../tests/test-utils';

describe('state helpers', () => {
    it('cloneAndUpdateState merges updates', () => {
        const current = TestMockFactory.createMockMealPlanningState({ iterationCount: 0 });
        const updated = cloneAndUpdateState(current as any, { iterationCount: 2 } as any);
        expect(updated.iterationCount).toBe(2);
        expect(updated.threadId).toBe(current.threadId);
    });
    it('deserializeMealPlanFromCheckpoint keeps plan shape', () => {
        const state = TestMockFactory.createMockMealPlanningState({
            mealPlan: TestMockFactory.createMockWeeklyMealPlan(),
        });
        const result = deserializeMealPlanFromCheckpoint(state as any);
        expect(result.mealPlan).toBeDefined();
        expect(result.mealPlan?.items?.length).toBeGreaterThan(0);
    });
});

