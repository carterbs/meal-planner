import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createRecipe, registerCreateRecipe, createRecipeArgs } from './createRecipe.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import type { CreateMealRequest, CreateMealResponse, AddBulkStepsRequest, Meal } from '@mealplanner/generated';
import { setupFetchMock } from '../test-utils.js';
import fetchMock from 'jest-fetch-mock';
import { createMockServer } from '../utils/createMockServer.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock the dependencies
jest.mock('../utils.js', () => ({
  API: 'http://test.com'
}));

jest.mock('@mealplanner/generated', () => ({
  Meal: jest.fn().mockImplementation((data) => data),
  CreateMealRequest: jest.fn().mockImplementation((data) => ({
    ...data as any,
    toJson: jest.fn().mockImplementation(() => data)
  })),
  CreateMealResponse: {
    fromJson: jest.fn().mockImplementation((data) => data)
  },
  AddBulkStepsRequest: jest.fn().mockImplementation((data) => ({
    ...data as any,
    toJson: jest.fn().mockImplementation(() => data)
  }))
}));

describe('createRecipe tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.enableMocks();
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createRecipeArgs schema', () => {
    it('should validate valid recipe data', () => {
      const validData = {
        name: 'Test Recipe',
        redMeat: false,
        effort: 'MED' as const,
        steps: [
          { order: 1, text: 'First step' },
          { order: 2, text: 'Second step' }
        ],
        ingredients: [
          { name: 'Flour', quantity: '2 cups' },
          { name: 'Eggs', quantity: '3 large' }
        ]
      };

      const result = createRecipeArgs.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should validate recipe without ingredients', () => {
      const validData = {
        name: 'Simple Recipe',
        redMeat: true,
        effort: 'LOW' as const,
        steps: [{ order: 1, text: 'Only step' }]
      };

      const result = createRecipeArgs.parse(validData);
      expect(result).toEqual(validData);
    });

    it('should reject invalid effort levels', () => {
      const invalidData = {
        name: 'Test Recipe',
        redMeat: false,
        effort: 'VERY_HIGH',
        steps: [{ order: 1, text: 'Step' }]
      };

      expect(() => createRecipeArgs.parse(invalidData)).toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => createRecipeArgs.parse({ name: 'Test' })).toThrow();
      expect(() => createRecipeArgs.parse({ redMeat: false })).toThrow();
      expect(() => createRecipeArgs.parse({ effort: 'LOW' })).toThrow();
      expect(() => createRecipeArgs.parse({})).toThrow();
    });

    it('should validate steps structure', () => {
      const invalidSteps = {
        name: 'Test Recipe',
        redMeat: false,
        effort: 'MED' as const,
        steps: [
          { order: 'first', text: 'Invalid order' }, // order should be number
        ]
      };

      expect(() => createRecipeArgs.parse(invalidSteps)).toThrow();
    });
  });

  describe('createRecipe', () => {
    it('should create recipe successfully with ingredients', async () => {
      const recipeData = {
        name: 'Pasta Carbonara',
        redMeat: false,
        effort: 'MED' as const,
        steps: [
          { order: 1, text: 'Boil pasta' },
          { order: 2, text: 'Make sauce' }
        ],
        ingredients: [
          { name: 'Pasta', quantity: '400g' },
          { name: 'Eggs', quantity: '3 large' }
        ]
      };

      const mockCreatedMeal = {
        id: 123,
        name: 'Pasta Carbonara',
        effort: 3,
        hasRedMeat: false,
        url: '',
        mealType: 'dinner',
        ingredients: [],
        steps: [],
        lastPlanned: undefined
      };

      const mockCreateResponse = { meal: mockCreatedMeal };

      const { Meal, CreateMealRequest, CreateMealResponse, AddBulkStepsRequest } = await import('@mealplanner/generated');

      fetchMock.mockResponseOnce(JSON.stringify(mockCreateResponse), { status: 200 });
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 200 });
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 200 });
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 200 });

      const result = await createRecipe(recipeData);

      // Verify meal creation
      expect(Meal).toHaveBeenCalledWith({
        id: 0,
        name: 'Pasta Carbonara',
        effort: 3,
        hasRedMeat: false,
        url: '',
        mealType: 'dinner',
        ingredients: [],
        steps: [],
        lastPlanned: undefined
      });

      expect(CreateMealRequest).toHaveBeenCalledWith({
        meal: expect.objectContaining({
          id: 0,
          name: 'Pasta Carbonara',
          effort: 3,
          hasRedMeat: false,
          url: '',
          mealType: 'dinner',
          ingredients: [],
          steps: [],
          lastPlanned: undefined
        })
      });

      // Verify steps addition
      expect(AddBulkStepsRequest).toHaveBeenCalledWith({
        mealId: 123,
        instructions: ['Boil pasta', 'Make sauce']
      });

      // Verify API calls via fetchMock
      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"meal"')
      });

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals/123/steps/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"mealId"')
      });

      // Verify ingredient calls
      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals/123/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pasta', quantity: '400g' })
      });

      expect(fetchMock).toHaveBeenCalledWith('http://test.com/api/meals/123/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Eggs', quantity: '3 large' })
      });

      expect(result).toEqual(mockCreatedMeal);
    });

    it('should create recipe without ingredients', async () => {
      const recipeData = {
        name: 'Simple Toast',
        redMeat: false,
        effort: 'LOW' as const,
        steps: [{ order: 1, text: 'Toast bread' }]
      };

      const mockCreatedMeal = {
        id: 456,
        name: 'Simple Toast',
        effort: 1,
        hasRedMeat: false,
        url: '',
        mealType: 'dinner',
        ingredients: [],
        steps: [],
        lastPlanned: undefined
      };

      const mockCreateResponse = { meal: mockCreatedMeal };

      fetchMock.mockResponseOnce(JSON.stringify(mockCreateResponse), { status: 200 });
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 200 });

      const result = await createRecipe(recipeData);

      expect(fetchMock).toHaveBeenCalledTimes(2); // Only meal creation and steps, no ingredients
      expect(result).toEqual(mockCreatedMeal);
    });

    it('should map effort levels correctly', async () => {
      const { Meal } = await import('@mealplanner/generated');

      const testCases = [
        { effort: 'LOW' as const, expectedEffort: 1 },
        { effort: 'MED' as const, expectedEffort: 3 },
        { effort: 'HIGH' as const, expectedEffort: 5 }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ meal: { id: 1 } }) } as any));
        fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as any));

        await createRecipe({
          name: 'Test',
          redMeat: false,
          effort: testCase.effort,
          steps: [{ order: 1, text: 'Test step' }]
        });

        expect(Meal).toHaveBeenCalledWith(expect.objectContaining({
          effort: testCase.expectedEffort
        }));
      }
    });

    it('should throw McpError when meal creation fails', async () => {
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 400, statusText: 'Bad Request', json: async () => ({}) } as any));

      const recipeData = {
        name: 'Failed Recipe',
        redMeat: false,
        effort: 'LOW' as const,
        steps: [{ order: 1, text: 'Step' }]
      };

      await expect(createRecipe(recipeData)).rejects.toThrow('BackendError: Bad Request');
    });

    it('should throw McpError when no meal returned from create request', async () => {
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ meal: null }) } as any));

      const recipeData = {
        name: 'No Meal Recipe',
        redMeat: false,
        effort: 'LOW' as const,
        steps: [{ order: 1, text: 'Step' }]
      };

      await expect(createRecipe(recipeData)).rejects.toThrow('No meal returned from create request');
    });

    it('should throw McpError when steps creation fails', async () => {
      const mockCreatedMeal = { id: 123, name: 'Test' };

      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ meal: mockCreatedMeal }) } as any));
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) } as any));

      const recipeData = {
        name: 'Failed Steps Recipe',
        redMeat: false,
        effort: 'LOW' as const,
        steps: [{ order: 1, text: 'Step' }]
      };

      await expect(createRecipe(recipeData)).rejects.toThrow('BackendError: Internal Server Error');
      
      // Verify the fetch was called the expected number of times
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw McpError when ingredient creation fails', async () => {
      const mockCreatedMeal = { id: 123, name: 'Test' };

      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ meal: mockCreatedMeal }) } as any));
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as any));
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 409, statusText: 'Conflict', json: async () => ({}) } as any));

      const recipeData = {
        name: 'Failed Ingredient Recipe',
        redMeat: false,
        effort: 'LOW' as const,
        steps: [{ order: 1, text: 'Step' }],
        ingredients: [{ name: 'Test Ingredient', quantity: '1 cup' }]
      };

      await expect(createRecipe(recipeData)).rejects.toThrow('BackendError: Conflict');
      
      // Verify the fetch was called the expected number of times
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('registerCreateRecipe', () => {
    it('should register tool with server', () => {
      const mockServer = createMockServer();

      registerCreateRecipe(mockServer);

      expect(mockServer.registeredTools['createRecipe']).toBeDefined();
    });

    it('should return formatted tool response when handler is called', async () => {
      const recipeData = {
        name: 'Handler Test Recipe',
        redMeat: true,
        effort: 'HIGH' as const,
        steps: [{ order: 1, text: 'Complex step' }]
      };

      const mockCreatedMeal = {
        id: 789,
        name: 'Handler Test Recipe',
        effort: 5,
        hasRedMeat: true,
        url: '',
        mealType: 'dinner',
        ingredients: [],
        steps: [],
        lastPlanned: undefined
      };

      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ meal: mockCreatedMeal }) } as any));
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as any));

      const server = createMockServer();
      registerCreateRecipe(server);

      // Get the handler function that was registered
      const handler = server.registeredTools['createRecipe'].handler;
      const result = await handler(recipeData);

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockCreatedMeal, null, 2) }]
      });
    });

    it('should propagate errors from createRecipe', async () => {
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 422, statusText: 'Unprocessable Entity', json: async () => ({}) } as any));

      const server = createMockServer();
      registerCreateRecipe(server);

      // Get the handler function that was registered
      const handler = server.registeredTools['createRecipe'].handler;

      const recipeData = {
        name: 'Error Recipe',
        redMeat: false,
        effort: 'LOW' as const,
        steps: [{ order: 1, text: 'Step' }]
      };

      await expect(handler(recipeData)).rejects.toThrow('BackendError: Unprocessable Entity');
    });
  });
});