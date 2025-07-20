import { DbCheckpointSaver } from '../shared/dbCheckpointer';
import { AgentCheckpoint, AgentCheckpointMetadata } from '@mealplanner/generated';
import { TestMockFactory } from './test-utils';
import { CheckpointRepository } from '../database/checkpoints';

jest.mock('../logging');
jest.mock('../database/checkpoints');

describe('DbCheckpointSaver put', () => {
  let repoMock: jest.Mocked<CheckpointRepository>;

  beforeEach(() => {
    repoMock = {
      getCheckpoint: jest.fn(),
      putCheckpoint: jest.fn().mockResolvedValue(undefined),
      listCheckpoints: jest.fn(),
      getWorkflowCheckpoint: jest.fn(),
      updateWorkflowCheckpoint: jest.fn().mockResolvedValue(undefined),
      listWorkflows: jest.fn(),
    } as any;
    (CheckpointRepository as unknown as jest.Mock).mockImplementation(() => repoMock);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls updateWorkflowCheckpoint with serialized checkpoint', async () => {
    const saver = new DbCheckpointSaver();
    const state = TestMockFactory.createMockMealPlanningState();
    const checkpoint = new AgentCheckpoint({ state, next: [], step: 0 });
    const metadata = new AgentCheckpointMetadata({ source: 'workflow', step: 0 });
    const config = { configurable: { threadId: 'test-id', checkpoint_ns: 'ns1' } } as any;
    await saver.put(config, checkpoint, metadata);
    expect(repoMock.putCheckpoint).toHaveBeenCalled();
    expect(repoMock.updateWorkflowCheckpoint).toHaveBeenCalledWith(
      'test-id',
      expect.any(Buffer)
    );
  });
});
