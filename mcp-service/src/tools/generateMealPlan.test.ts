import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { generateMealPlan, registerGenerateMealPlan } from './generateMealPlan.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { MealPlan, MealPlanItem, MealPlanStatus, MealSlot, Meal, GenerateMealPlanResponse } from '@mealplanner/generated';
import { createMockServer } from '../utils/createMockServer.js';

function slotToMealTypeName(slot: MealSlot): string {
  switch (slot) {
    case MealSlot.BREAKFAST:
      return 'breakfast';
    case MealSlot.LUNCH:
      return 'lunch';
    case MealSlot.DINNER:
    default:
      return 'dinner';
  }
}

function buildMeal(overrides: Partial<Meal> = {}): Meal {
  return new Meal({
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Meal',
    effort: overrides.effort ?? 3,
    hasRedMeat: overrides.hasRedMeat ?? false,
    url: overrides.url ?? '',
    mealType: overrides.mealType ?? 'dinner',
    ingredients: overrides.ingredients ?? [],
    steps: overrides.steps ?? [],
  });
}

function buildPlanItem(options: {
  id?: number;
  dayIndex?: number;
  slot?: MealSlot;
  meal?: Meal | null;
} = {}): MealPlanItem {
  const slot = options.slot ?? MealSlot.DINNER;
  const mealExplicit = Object.prototype.hasOwnProperty.call(options, 'meal');
  const meal = mealExplicit
    ? options.meal
    : buildMeal({
        id: options.id ?? 1,
        name: `Meal ${options.id ?? 1}`,
        mealType: slotToMealTypeName(slot),
      });

  return new MealPlanItem({
    id: options.id ?? 1,
    dayIndex: options.dayIndex ?? 0,
    mealType: slot,
    mealId: meal?.id ?? undefined,
    mealSnapshot: meal ?? undefined,
  });
}

function buildResponse(
  items: MealPlanItem[],
  overrides: { id?: number; status?: MealPlanStatus; version?: number } = {},
): GenerateMealPlanResponse {
  return new GenerateMealPlanResponse({
    plan: new MealPlan({
      id: overrides.id ?? 1,
      status: overrides.status ?? MealPlanStatus.DRAFT,
      version: overrides.version ?? 1,
      items,
    }),
  });
}

// Mock the dependencies
jest.mock('../logging.js', () => ({
  debugLog: jest.fn(async () => undefined),
  infoLog: jest.fn(async () => undefined),
  warnLog: jest.fn(async () => undefined),
  errorLog: jest.fn(async () => undefined)
}));

// Preserve the real retryFetch implementation but override API for tests
jest.mock('../utils.js', () => ({
  API: 'http://test.com',
  retryFetch: jest.fn()
}));

describe('generateMealPlan tool', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // reset mocked utils
    const { retryFetch } = await import('../utils.js');
    (retryFetch as jest.MockedFunction<any>).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateMealPlan', () => {
    it('should generate meal plan successfully', async () => {
      const mockResponse = buildResponse(
        [
          buildPlanItem({
            id: 1,
            dayIndex: 0,
            slot: MealSlot.DINNER,
            meal: buildMeal({ id: 1, name: 'Pasta', mealType: 'dinner' }),
          }),
        ],
        { id: 42, version: 3, status: MealPlanStatus.DRAFT },
      );

      const { infoLog } = await import('../logging.js');

      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      } as any);

      const result = await generateMealPlan();

      expect(retryFetch).toHaveBeenCalledWith('http://test.com/api/mealplan/generate', { method: 'POST' });
      expect(result).toEqual(mockResponse);
      expect(infoLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] About to fetch: http://test.com/api/mealplan/generate');
      expect(infoLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] Successfully parsed JSON response');
    });

    it('should log environment variables and API details', async () => {
      const mockResponse = buildResponse([], { id: 1, version: 1, status: MealPlanStatus.DRAFT });

      const { infoLog } = await import('../logging.js');

      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      } as any);

      await generateMealPlan();

      expect(infoLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] API variable: http://test.com');
      expect(infoLog).toHaveBeenCalledWith(`🔧 [MCP-FETCH] BACKEND_BASE_URL env: ${process.env.BACKEND_BASE_URL || 'NOT_SET'}`);
    });

    it('should log day index information for debugging', async () => {
      const mockResponse = buildResponse(
        [
          buildPlanItem({
            id: 11,
            dayIndex: 0,
            slot: MealSlot.DINNER,
            meal: buildMeal({ id: 1, name: 'Pasta', mealType: 'dinner' }),
          }),
          buildPlanItem({
            id: 12,
            dayIndex: 1,
            slot: MealSlot.LUNCH,
            meal: buildMeal({ id: 2, name: 'Salad', effort: 1, mealType: 'lunch' }),
          }),
        ],
        { id: 2, version: 7, status: MealPlanStatus.DRAFT },
      );

      const { infoLog } = await import('../logging.js');

      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      } as any);

      await generateMealPlan();

      expect(infoLog).toHaveBeenCalledWith('🔍 [MCP] Checking dayIndex values from backend:');
      expect(infoLog).toHaveBeenCalledWith('🔍 [MCP] Entry 0: dayIndex=0, mealType=MEAL_SLOT_DINNER, meal=Pasta');
      expect(infoLog).toHaveBeenCalledWith('🔍 [MCP] Entry 1: dayIndex=1, mealType=MEAL_SLOT_LUNCH, meal=Salad');
    });

    it('should handle response with no meals', async () => {
      const mockResponse = buildResponse(
        [
          buildPlanItem({ id: 22, dayIndex: 0, slot: MealSlot.DINNER, meal: null }),
        ],
        { id: 3, version: 1, status: MealPlanStatus.DRAFT },
      );

      const { infoLog } = await import('../logging.js');

      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      } as any);

      await generateMealPlan();

      expect(infoLog).toHaveBeenCalledWith('🔍 [MCP] Entry 0: dayIndex=0, mealType=MEAL_SLOT_DINNER, meal=nil');
    });

    it('should throw McpError when response is not ok', async () => {
      const { errorLog } = await import('../logging.js');

      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error details'
      } as any);

      await expect(generateMealPlan()).rejects.toThrow(McpError);
      await expect(generateMealPlan()).rejects.toThrow('BackendError: Internal Server Error');

      expect(errorLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] Error response body: Server error details');
    });

    it('should handle retryFetch errors', async () => {
      const { errorLog } = await import('../logging.js');

      const fetchError = new Error('Network timeout');
      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockRejectedValue(fetchError);

      await expect(generateMealPlan()).rejects.toThrow(McpError);
      await expect(generateMealPlan()).rejects.toThrow('fetch failed: Error: Network timeout');

      expect(errorLog).toHaveBeenCalledWith('🔧 [MCP-FETCH] Fetch failed with error: Error: Network timeout');
    });

    it('should handle malformed JSON response', async () => {
      const { errorLog } = await import('../logging.js');

      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => { throw new Error('Invalid JSON'); }
      } as any);

      await expect(generateMealPlan()).rejects.toThrow(McpError);

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('🔧 [MCP-FETCH] Fetch failed with error:'));
    });
  });

  describe('registerGenerateMealPlan', () => {
    it('should register tool with server', () => {
      const server = createMockServer();

      registerGenerateMealPlan(server as any);

      expect(server.registeredTools['generateMealPlan']).toBeDefined();
    });

    it('should return formatted tool response when handler is called', async () => {
      const mockResponse = buildResponse(
        [
          buildPlanItem({
            id: 31,
            dayIndex: 0,
            slot: MealSlot.DINNER,
            meal: buildMeal({ id: 1, name: 'Test Meal', mealType: 'dinner' }),
          }),
        ],
        { id: 4, version: 2, status: MealPlanStatus.DRAFT },
      );

      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse
      } as any);

      const server = createMockServer();
      registerGenerateMealPlan(server as any);

      const handler = server.registeredTools['generateMealPlan'].handler;
      const result = await handler();

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
      });
    });

    it('should propagate errors from generateMealPlan', async () => {
      const { retryFetch } = await import('../utils.js');
      (retryFetch as jest.MockedFunction<any>).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => 'Service down'
      } as any);

      const server = createMockServer();
      registerGenerateMealPlan(server as any);

      const handler = server.registeredTools['generateMealPlan'].handler;

      await expect(handler()).rejects.toThrow(McpError);
      await expect(handler()).rejects.toThrow('BackendError: Service Unavailable');
    });
  });
});
