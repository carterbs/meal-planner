import { updateMeal, createMeal } from './mealsApi';
import type { 
  MainMealResponse, 
  MainErrorResponse,
  PostMealsResponses,
  PostMealsErrors,
  PutMealsByMealIdResponses,
  PutMealsByMealIdErrors
} from '@mealplanner/generated/dist/gateway/types.gen';
import type { RequestResult } from '@mealplanner/generated/dist/gateway/client/types';

// Define the return types for our mocked functions
type PostMealsResult = RequestResult<PostMealsResponses, PostMealsErrors, false, 'fields'>;
type PutMealsResult = RequestResult<PutMealsByMealIdResponses, PutMealsByMealIdErrors, false, 'fields'>;

// Mock the generated client functions
jest.mock('@mealplanner/generated/dist/gateway/index.js', () => ({
  postMeals: jest.fn(),
  putMealsByMealId: jest.fn(),
}));

// Import the mocked functions
import { postMeals, putMealsByMealId } from '@mealplanner/generated/dist/gateway/index.js';

const mockPostMeals = postMeals as jest.MockedFunction<any>;
const mockPutMealsByMealId = putMealsByMealId as jest.MockedFunction<any>;

describe('updateMeal', () => {
  const mockMeal: MainMealResponse = {
    id: 1,
    name: 'Test Meal',
    effort: 2,
    hasRedMeat: false,
    url: 'https://example.com',
    mealType: 'dinner',
    ingredients: [],
    steps: [],
  };

  beforeEach(() => {
    mockPutMealsByMealId.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('successfully updates a meal', async () => {
    const updatedMeal = { ...mockMeal, mealType: 'lunch' as const };
    const expectedResponse = {
      id: 1,
      name: 'Test Meal',
      effort: 2,
      hasRedMeat: false,
      url: 'https://example.com',
      mealType: 'lunch',
      ingredients: [],
      steps: [],
    };

    mockPutMealsByMealId.mockResolvedValue({
      data: expectedResponse,
      error: undefined,
      request: {} as Request,
      response: {} as Response,
    });

    const result = await updateMeal(1, updatedMeal);

    expect(mockPutMealsByMealId).toHaveBeenCalledWith({
      client: expect.any(Object),
      path: { mealId: 1 },
      body: {
        meal_id: 1,
        meal: updatedMeal,
      },
    });

    expect(result).toEqual({
      id: 1,
      name: 'Test Meal',
      effort: 2,
      hasRedMeat: false,
      url: 'https://example.com',
      mealType: 'lunch',
      ingredients: [],
      steps: [],
    });
  });

  test('handles HTTP error response', async () => {
    mockPutMealsByMealId.mockResolvedValue({
      data: undefined,
      error: { error: 'Server error' } as MainErrorResponse,
      request: {} as Request,
      response: {} as Response,
    });

    await expect(updateMeal(1, mockMeal)).rejects.toThrow(
      'Failed to update meal: Server error'
    );

    expect(mockPutMealsByMealId).toHaveBeenCalledWith({
      client: expect.any(Object),
      path: { mealId: 1 },
      body: {
        meal_id: 1,
        meal: mockMeal,
      },
    });
  });

  test('handles network error', async () => {
    mockPutMealsByMealId.mockRejectedValueOnce(
      new Error('Network error')
    );

    await expect(updateMeal(1, mockMeal)).rejects.toThrow('Network error');
  });

  test('handles response without meal data', async () => {
    mockPutMealsByMealId.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    } as any);

    await expect(updateMeal(1, mockMeal)).rejects.toThrow(
      'Failed to update meal: Unknown error'
    );
  });

  test('handles malformed JSON response', async () => {
    mockPutMealsByMealId.mockRejectedValueOnce(
      new Error('Invalid JSON')
    );

    await expect(updateMeal(1, mockMeal)).rejects.toThrow('Invalid JSON');
  });

  test('correctly formats request with all meal fields', async () => {
    const complexMeal: MainMealResponse = {
      id: 42,
      name: 'Complex Meal',
      effort: 5,
      hasRedMeat: true,
      url: 'https://recipe.com/complex',
      mealType: 'breakfast',
      ingredients: [
        {
          id: 1,
          mealId: 42,
          name: 'Ingredient 1',
          quantity: 2,
          unit: 'cups',
        },
      ],
      steps: [
        {
          id: 1,
          mealId: 42,
          stepNumber: 1,
          instruction: 'First step',
        },
      ],
    };

    mockPutMealsByMealId.mockResolvedValueOnce({
      data: complexMeal,
      error: null,
    });

    await updateMeal(42, complexMeal);

    expect(mockPutMealsByMealId).toHaveBeenCalledWith({
      client: expect.any(Object),
      path: { mealId: 42 },
      body: {
        meal_id: 42,
        meal: complexMeal,
      },
    });
  });
});

describe('createMeal', () => {
  const mockMealInput: Omit<MainMealResponse, 'id'> = {
    name: 'New Test Meal',
    effort: 3,
    hasRedMeat: true,
    url: 'https://example.com/new-recipe',
    mealType: 'dinner',
    ingredients: [
      {
        id: 0,
        mealId: 0,
        name: 'Test Ingredient',
        quantity: 1,
        unit: 'cup',
      },
    ],
    steps: [
      {
        id: 0,
        mealId: 0,
        stepNumber: 1,
        instruction: 'Test instruction',
      },
    ],
  };

  beforeEach(() => {
    mockPostMeals.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('successfully creates a meal and returns mapped meal object', async () => {
    const expectedBackendResponse = {
      id: 123,
      name: 'New Test Meal',
      effort: 3,
      hasRedMeat: true,
      url: 'https://example.com/new-recipe',
      mealType: 'dinner',
      ingredients: [
        {
          id: 456,
          mealId: 123,
          name: 'Test Ingredient',
          quantity: 1,
          unit: 'cup',
        },
      ],
      steps: [
        {
          id: 789,
          mealId: 123,
          stepNumber: 1,
          instruction: 'Test instruction',
        },
      ],
    };

    mockPostMeals.mockResolvedValueOnce({
      data: expectedBackendResponse,
      error: null,
    });

    const result = await createMeal(mockMealInput);

    expect(mockPostMeals).toHaveBeenCalledWith({
      client: expect.any(Object),
      body: { meal: { id: 0, ...mockMealInput } },
    });

    expect(result).toEqual({
      id: 123,
      name: 'New Test Meal',
      effort: 3,
      hasRedMeat: true,
      url: 'https://example.com/new-recipe',
      mealType: 'dinner',
      ingredients: [
        {
          id: 456,
          mealId: 123,
          name: 'Test Ingredient',
          quantity: 1,
          unit: 'cup',
        },
      ],
      steps: [
        {
          id: 789,
          mealId: 123,
          stepNumber: 1,
          instruction: 'Test instruction',
        },
      ],
    });
  });

  test('throws error when backend returns error', async () => {
    mockPostMeals.mockResolvedValueOnce({
      data: null,
      error: 'Failed to create meal in database',
    });

    await expect(createMeal(mockMealInput)).rejects.toThrow(
      'Failed to create meal: Failed to create meal in database'
    );
  });

  test('throws error when backend returns no data', async () => {
    mockPostMeals.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(createMeal(mockMealInput)).rejects.toThrow(
      'Failed to create meal: Unknown error'
    );
  });

  test('throws error when backend returns response without meal field', async () => {
    mockPostMeals.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(createMeal(mockMealInput)).rejects.toThrow(
      'Failed to create meal: Unknown error'
    );
  });

  test('throws error when backend returns response with null meal field', async () => {
    mockPostMeals.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(createMeal(mockMealInput)).rejects.toThrow(
      'Failed to create meal: Unknown error'
    );
  });

  test('correctly formats meal data with temporary IDs for ingredients and steps', async () => {
    const mealWithTempIds: Omit<MainMealResponse, 'id'> = {
      name: 'Meal with temp IDs',
      effort: 2,
      hasRedMeat: false,
      url: '',
      mealType: 'lunch',
      ingredients: [
        {
          id: -1, // Temporary ID from frontend
          mealId: 0,
          name: 'Temp Ingredient',
          quantity: 2,
          unit: 'tbsp',
        },
      ],
      steps: [
        {
          id: -1, // Temporary ID from frontend
          mealId: 0,
          stepNumber: 1,
          instruction: 'Temp step',
        },
      ],
    };

    const expectedBackendResponse = {
      id: 999,
      ...mealWithTempIds,
      ingredients: [
        {
          id: 1001,
          mealId: 999,
          name: 'Temp Ingredient',
          quantity: 2,
          unit: 'tbsp',
        },
      ],
      steps: [
        {
          id: 2001,
          mealId: 999,
          stepNumber: 1,
          instruction: 'Temp step',
        },
      ],
    };

    mockPostMeals.mockResolvedValueOnce({
      data: expectedBackendResponse,
      error: undefined,
    } as any);

    await createMeal(mealWithTempIds);

    expect(mockPostMeals).toHaveBeenCalledWith({
      client: expect.any(Object),
      body: { meal: { id: 0, ...mealWithTempIds } },
    });
  });
});