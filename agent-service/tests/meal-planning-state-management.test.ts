import { MealPlanningWorkflow } from '../workflows/meal-planning';
import { MealPlanningStep } from '../shared/types';
import { AgentCheckpoint, AgentCheckpointMetadata } from '@mealplanner/generated';
import { DbCheckpointSaver } from '../shared/dbCheckpointer';
import { TestMockFactory, TestAssertionHelpers, setupConsoleMocks, restoreConsoleMocks } from './test-utils';

// Mock external dependencies
jest.mock('../utils/getBackendClient');
jest.mock('../logging');
jest.mock('../cli');

describe('MealPlanningWorkflow State Management Tests', () => {
  let workflow: any;
  let mockCheckpointer: jest.Mocked<DbCheckpointSaver>;
  let mockClient: any;
  let mockLLM: any;
  let mockConfig: any;

  beforeEach(() => {
    setupConsoleMocks();
    
    mockCheckpointer = TestMockFactory.createMockCheckpointer() as any;
    mockClient = TestMockFactory.createMockMCPClient();
    mockLLM = TestMockFactory.createMockLLM();
    mockConfig = TestMockFactory.createMockExtendedRunnableConfig();

    workflow = new MealPlanningWorkflow(mockCheckpointer) as any;
    workflow.client = mockClient;
    workflow.llm = mockLLM;
    workflow.nanoLlm = mockLLM;
  });

  afterEach(() => {
    restoreConsoleMocks();
    jest.clearAllMocks();
  });

  describe('saveCheckpoint', () => {
    it('saves checkpoint with valid state structure', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.PRESENT_PLAN,
        mealPlan: TestMockFactory.createMockWeeklyMealPlan(),
      });

      await workflow.saveCheckpoint(mockConfig, mockState);

      expect(mockCheckpointer.put).toHaveBeenCalledWith(
        mockConfig,
        expect.any(AgentCheckpoint),
        expect.any(AgentCheckpointMetadata)
      );

      const checkpointCall = mockCheckpointer.put.mock.calls[0];
      const checkpoint = checkpointCall[1] as AgentCheckpoint;
      const metadata = checkpointCall[2] as AgentCheckpointMetadata;

      expect(checkpoint.state).toBe(mockState);
      expect(checkpoint.next).toEqual([]);
      expect(checkpoint.step).toBe(0);
      expect(metadata.source).toBe('workflow');
      expect(metadata.step).toBe(0);
    });

    it('handles checkpoint serialization errors', async () => {
      // Create a state with problematic data that might cause serialization issues
      const mockState = TestMockFactory.createMockMealPlanningState({
        mealPlan: TestMockFactory.createMockWeeklyMealPlan([
          TestMockFactory.createMockMealPlanEntry({
            meal: TestMockFactory.createMockMeal({
              lastPlanned: new Date() as any, // This might cause serialization issues
            }),
          }),
        ]),
      });

      // Mock the toJson method to throw an error instead of mocking the constructor
      const originalToJson = mockState.mealPlan!.toJson;
      mockState.mealPlan!.toJson = jest.fn().mockImplementation(() => {
        throw new Error('Serialization error');
      });

      await expect(workflow.saveCheckpoint(mockConfig, mockState)).rejects.toThrow('Serialization error');

      // Restore the original method
      mockState.mealPlan!.toJson = originalToJson;
    });
  });

  describe('updateState', () => {
    it('updates state with partial changes', () => {
      const currentState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.INITIATE,
        iterationCount: 0,
      });

      const updates = {
        currentStep: MealPlanningStep.GENERATE_PLAN,
        iterationCount: 1,
      };

      const result = workflow.updateState(currentState, updates);

      TestAssertionHelpers.assertStateStructure(result);
      expect(result.currentStep).toBe(MealPlanningStep.GENERATE_PLAN);
      expect(result.iterationCount).toBe(1);
      expect(result.threadId).toBe(currentState.threadId);
      expect(result.participants).toEqual(currentState.participants);
      expect(result.updatedAt).toBeDefined();
    });

    it('preserves existing state when no updates provided', () => {
      const currentState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.PRESENT_PLAN,
        mealPlan: TestMockFactory.createMockWeeklyMealPlan(),
      });

      const result = workflow.updateState(currentState, {});

      expect(result.currentStep).toBe(currentState.currentStep);
      expect(result.mealPlan).toBe(currentState.mealPlan);
      expect(result.threadId).toBe(currentState.threadId);
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('coerceDates', () => {
    it('coerces dates properly before serialization', () => {
      const mealPlan = TestMockFactory.createMockWeeklyMealPlan([
        TestMockFactory.createMockMealPlanEntry({
          meal: TestMockFactory.createMockMeal({
            lastPlanned: new Date() as any,
          }),
        }),
      ]);

      workflow.coerceDates(mealPlan);

      expect(mealPlan.days[0].meal?.lastPlanned).toBeUndefined();
    });

    it('handles undefined meal plan', () => {
      expect(() => workflow.coerceDates(undefined)).not.toThrow();
    });

    it('handles meal plan with no days', () => {
      const mealPlan = TestMockFactory.createMockWeeklyMealPlan([]);
      expect(() => workflow.coerceDates(mealPlan)).not.toThrow();
    });

    it('handles meal plan with entries without meals', () => {
      const mealPlan = TestMockFactory.createMockWeeklyMealPlan([
        TestMockFactory.createMockMealPlanEntry({
          meal: undefined,
        }),
      ]);
      expect(() => workflow.coerceDates(mealPlan)).not.toThrow();
    });
  });

  describe('checkpoint loading and deserialization', () => {
    it('loads checkpoint and deserializes meal plan correctly', async () => {
      const mockMealPlan = TestMockFactory.createMockWeeklyMealPlan();
      const mockState = TestMockFactory.createMockMealPlanningState({
        currentStep: MealPlanningStep.PRESENT_PLAN,
        mealPlan: mockMealPlan,
      });

      const mockCheckpoint = new AgentCheckpoint({
        state: mockState,
        next: [],
        step: 0,
      });

      mockCheckpointer.getTuple.mockResolvedValue([mockCheckpoint, {} as any]);

      // Mock the backend client to return messages
      const mockBackendClient = TestMockFactory.createMockBackendClient();
      mockBackendClient.getMessages.mockResolvedValue({
        messages: [
          TestMockFactory.createMockMessage({
            content: 'User is satisfied with the plan',
            createdAt: new Date().toISOString(),
          }),
        ],
      });

      // Mock getBackendClient to return our mock
      const { getBackendClient } = require('../utils/getBackendClient');
      getBackendClient.mockReturnValue(mockBackendClient);

      // Mock the LLM to return satisfaction
      mockLLM.invoke.mockResolvedValue({
        content: '{"satisfied": true, "reasoning": "User is happy"}',
      });

      const result = await workflow.graph.invoke({}, mockConfig);

      expect(result).toBeDefined();
      TestAssertionHelpers.assertStateStructure(result);
      expect(mockCheckpointer.getTuple).toHaveBeenCalledWith(mockConfig);
    });

    it('handles invalid checkpoint state format', async () => {
      const invalidCheckpoint = new AgentCheckpoint({
        state: undefined as any,
        next: [],
        step: 0,
      });

      mockCheckpointer.getTuple.mockResolvedValue([invalidCheckpoint, {} as any]);

      await expect(workflow.graph.invoke({}, mockConfig)).rejects.toThrow('Invalid checkpoint state format');
    });

    it('handles checkpoint with missing updatedAt', async () => {
      const mockState = TestMockFactory.createMockMealPlanningState({
        updatedAt: undefined as any,
      });

      const mockCheckpoint = new AgentCheckpoint({
        state: mockState,
        next: [],
        step: 0,
      });

      mockCheckpointer.getTuple.mockResolvedValue([mockCheckpoint, {} as any]);

      await expect(workflow.graph.invoke({}, mockConfig)).rejects.toThrow('Invalid checkpoint state format');
    });
  });

  describe('initial state creation', () => {
    it('creates initial state when no checkpoint exists', async () => {
      mockCheckpointer.getTuple.mockResolvedValue(undefined);

      // Mock MCP client responses for the workflow
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: JSON.stringify({ plan: TestMockFactory.createMockWeeklyMealPlan().toJson() }) }],
      });

      const result = await workflow.graph.invoke({}, mockConfig);

      expect(result).toBeDefined();
      TestAssertionHelpers.assertStateStructure(result);
      expect(result.currentStep).toBe(MealPlanningStep.AWAIT_FEEDBACK);
      expect(result.threadId).toBe(mockConfig.configurable.threadId);
      expect(result.participants).toEqual(['brad']);
      expect(result.iterationCount).toBe(1);
      expect(result.mealPlan).toBeDefined();
    });

    it('generates unique thread ID when none provided', async () => {
      mockCheckpointer.getTuple.mockResolvedValue(undefined);
      
      const configWithoutThreadId = {
        configurable: {},
      };

      // Mock MCP client responses for the workflow
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: JSON.stringify({ plan: TestMockFactory.createMockWeeklyMealPlan().toJson() }) }],
      });

      const result = await workflow.graph.invoke({}, configWithoutThreadId);

      expect(result.threadId).toBeDefined();
      expect(typeof result.threadId).toBe('string');
      expect(result.threadId.length).toBeGreaterThan(0);
    });
  });
});