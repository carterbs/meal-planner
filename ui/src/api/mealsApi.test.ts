import {
  getMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  updateMealIngredient,
  createMealIngredient,
  deleteMealIngredient,
  addBulkSteps,
  deleteAllSteps,
  replaceAllSteps,
  goGetShoppingList,
} from './mealsApi';
import {
  Meal,
  Step,
  MealPlan,
  MealPlanItem,
  MealSlot,
} from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';
import * as gatewayModule from '@mealplanner/generated/gateway';

jest.mock('@mealplanner/generated/gateway');
jest.mock('@mealplanner/generated/gateway/client', () => ({
  createClient: jest.fn(() => 'mockClient'),
  createConfig: jest.fn(() => ({})),
}));

const mockedGateway = gatewayModule as jest.Mocked<typeof gatewayModule>;

type GoMealType = import('@mealplanner/generated/gateway/types.gen').GoMeal;

describe('mealsApi', () => {
  const mockGoMeal = {
    id: 1,
    name: 'Test Meal',
    effort: 3,
    hasRedMeat: false,
    url: 'http://example.com',
    mealType: 'dinner',
    lastPlanned: '2023-01-01T00:00:00Z',
    ingredients: [
      { id: 1, mealId: 1, name: 'ingredient1', quantity: 1, unit: 'cup' },
    ],
    steps: [{ id: 1, mealId: 1, stepNumber: 1, instruction: 'step1' }],
  };

  const mockStep = {
    id: 1,
    mealId: 1,
    stepNumber: 1,
    instruction: 'Test instruction',
  };

  const mockIngredient = {
    id: 1,
    mealId: 1,
    name: 'Test ingredient',
    quantity: 1,
    unit: 'cup',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMeals', () => {
    it('should fetch meals successfully', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mockGoMeal] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      const result = await getMeals();

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Meal);
      expect(result[0].name).toBe('Test Meal');
      expect(result[0].lastPlanned).toBeInstanceOf(Timestamp);
    });

    it('should handle meals with null/undefined values in mapping', async () => {
      const mealWithNullValues = {
        id: null,
        name: null,
        effort: null,
        hasRedMeat: null,
        url: null,
        mealType: null,
        lastPlanned: null,
        ingredients: null,
        steps: null,
      };

      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mealWithNullValues] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      const result = await getMeals();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(0);
      expect(result[0].name).toBe('');
      expect(result[0].effort).toBe(0);
      expect(result[0].hasRedMeat).toBe(false);
      expect(result[0].url).toBe('');
      expect(result[0].mealType).toBe('');
      expect(result[0].ingredients).toEqual([]);
      expect(result[0].steps).toEqual([]);
    });

    it('should handle meals with undefined ingredients and steps', async () => {
      const mealWithUndefinedArrays = {
        ...mockGoMeal,
        ingredients: undefined,
        steps: undefined,
      };

      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mealWithUndefinedArrays] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      const result = await getMeals();

      expect(result[0].ingredients).toEqual([]);
      expect(result[0].steps).toEqual([]);
    });

    it('should handle ingredients and steps with null/undefined values', async () => {
      const mealWithNullIngredientAndStep = {
        ...mockGoMeal,
        ingredients: [
          {
            id: null,
            mealId: null,
            name: null,
            quantity: null,
            unit: null,
          },
        ],
        steps: [
          {
            id: null,
            mealId: null,
            stepNumber: null,
            instruction: null,
          },
        ],
      };

      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mealWithNullIngredientAndStep] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      const result = await getMeals();

      expect(result[0].ingredients).toHaveLength(1);
      expect(result[0].ingredients[0].id).toBe(0);
      expect(result[0].ingredients[0].mealId).toBe(0);
      expect(result[0].ingredients[0].name).toBe('');
      expect(result[0].ingredients[0].quantity).toBe(0);
      expect(result[0].ingredients[0].unit).toBe('');

      expect(result[0].steps).toHaveLength(1);
      expect(result[0].steps[0].id).toBe(0);
      expect(result[0].steps[0].mealId).toBe(0);
      expect(result[0].steps[0].stepNumber).toBe(0);
      expect(result[0].steps[0].instruction).toBe('');
    });

    it('should handle meals without lastPlanned field', async () => {
      const mealWithoutLastPlanned: Record<string, unknown> = {
        ...mockGoMeal,
      };
      delete mealWithoutLastPlanned.lastPlanned;

      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mealWithoutLastPlanned] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      const result = await getMeals();

      expect(result[0].lastPlanned).toBeUndefined();
    });

    it('should handle empty string lastPlanned', async () => {
      const mealWithEmptyLastPlanned = {
        ...mockGoMeal,
        lastPlanned: '',
      };

      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mealWithEmptyLastPlanned] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      const result = await getMeals();

      expect(result[0].lastPlanned).toBeUndefined();
    });

    it('should fetch meals with meal type filter', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mockGoMeal] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      await getMeals('DINNER');

      expect(mockedGateway.getMeals).toHaveBeenCalledWith({
        client: 'mockClient',
        query: { type: 'dinner' },
      });
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: null,
        error: 'Network error',
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      await expect(getMeals()).rejects.toThrow(
        'Failed to fetch meals: Network error',
      );
    });

    it('should throw error when no data returned', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: null,
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      await expect(getMeals()).rejects.toThrow(
        'Failed to fetch meals: Unknown error',
      );
    });

    it('should handle empty meals array', async () => {
      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: null },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      const result = await getMeals();
      expect(result).toEqual([]);
    });

    it('should handle meals with invalid lastPlanned date', async () => {
      const mealWithInvalidDate = {
        ...mockGoMeal,
        lastPlanned: 'invalid-date',
      };

      mockedGateway.getMeals.mockResolvedValue({
        data: { meals: [mealWithInvalidDate] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.getMeals> extends Promise<infer T> ? T : never);

      const result = await getMeals();
      expect(result[0].lastPlanned).toBeUndefined();
    });
  });

  describe('createMeal', () => {
    it('should create meal successfully', async () => {
      mockedGateway.postMeals.mockResolvedValue({
        data: JSON.stringify({ meal: mockGoMeal }),
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMeals> extends Promise<infer T> ? T : never);

      const mealData: Record<string, unknown> = { ...mockGoMeal };
      delete mealData.id;

      const result = await createMeal(mealData as Omit<GoMealType, 'id'>);

      expect(result).toBeInstanceOf(Meal);
      expect(result.name).toBe('Test Meal');
    });

    it('should handle string-encoded meal response', async () => {
      mockedGateway.postMeals.mockResolvedValue({
        data: JSON.stringify({ meal: mockGoMeal }),
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMeals> extends Promise<infer T> ? T : never);

      const mealData2: Record<string, unknown> = { ...mockGoMeal };
      delete mealData2.id;

      const result = await createMeal(mealData2 as Omit<GoMealType, 'id'>);

      expect(result).toBeInstanceOf(Meal);
      expect(result.name).toBe('Test Meal');
    });

    it('should throw error when API returns error object', async () => {
      mockedGateway.postMeals.mockResolvedValue({
        data: null,
        error: { error: 'Validation failed' },
      } as unknown as ReturnType<typeof mockedGateway.postMeals> extends Promise<infer T> ? T : never);

      const mealData3: Record<string, unknown> = { ...mockGoMeal };
      delete mealData3.id;

      await expect(createMeal(mealData3 as Omit<GoMealType, 'id'>)).rejects.toThrow(
        'Failed to create meal: Validation failed',
      );
    });

    it('should throw error when API returns error string', async () => {
      mockedGateway.postMeals.mockResolvedValue({
        data: null,
        error: 'Database error',
      } as unknown as ReturnType<typeof mockedGateway.postMeals> extends Promise<infer T> ? T : never);

      const mealData4: Record<string, unknown> = { ...mockGoMeal };
      delete mealData4.id;

      await expect(createMeal(mealData4 as Omit<GoMealType, 'id'>)).rejects.toThrow(
        'Failed to create meal: Database error',
      );
    });

    it('should throw error when API returns generic error object without error property', async () => {
      mockedGateway.postMeals.mockResolvedValue({
        data: null,
        error: { message: 'Something went wrong' }, // No 'error' property
      } as unknown as ReturnType<typeof mockedGateway.postMeals> extends Promise<infer T> ? T : never);

      const mealData5: Record<string, unknown> = { ...mockGoMeal };
      delete mealData5.id;

      await expect(createMeal(mealData5 as Omit<GoMealType, 'id'>)).rejects.toThrow(
        'Failed to create meal: [object Object]',
      );
    });

    it('should handle invalid JSON in data field', async () => {
      mockedGateway.postMeals.mockResolvedValue({
        data: 'invalid json{',
        error: undefined,
      } as unknown as ReturnType<typeof mockedGateway.postMeals> extends Promise<infer T> ? T : never);

      const mealData6: Record<string, unknown> = { ...mockGoMeal };
      delete mealData6.id;

      await expect(createMeal(mealData6 as Omit<GoMealType, 'id'>)).rejects.toThrow(
        /Failed to parse meal response/,
      );
    });

    it('should throw error when no meal returned', async () => {
      mockedGateway.postMeals.mockResolvedValue({
        data: JSON.stringify({}), // Empty object in JSON string format
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMeals> extends Promise<infer T> ? T : never);

      const mealData7: Record<string, unknown> = { ...mockGoMeal };
      delete mealData7.id;

      await expect(createMeal(mealData7 as Omit<GoMealType, 'id'>)).rejects.toThrow(
        'No meal returned from create request',
      );
    });

    it('should handle JSON string response format from HTTP client', async () => {
      // Simulate actual HTTP client behavior - JSON stringified response
      mockedGateway.postMeals.mockResolvedValue({
        data: JSON.stringify({ meal: mockGoMeal }),
      } as unknown as ReturnType<typeof mockedGateway.postMeals> extends Promise<infer T> ? T : never);

      const mealData8: Record<string, unknown> = { ...mockGoMeal };
      delete mealData8.id;

      const result = await createMeal(mealData8 as Omit<GoMealType, 'id'>);

      expect(result).toBeInstanceOf(Meal);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Meal');
      expect(result.effort).toBe(3);
      expect(result.hasRedMeat).toBe(false);
    });
  });

  describe('updateMeal', () => {
    it('should update meal successfully', async () => {
      mockedGateway.putMealsByMealId.mockResolvedValue({
        data: { meal: mockGoMeal },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.putMealsByMealId> extends Promise<infer T> ? T : never);

      const result = await updateMeal(1, mockGoMeal);

      expect(result).toBeInstanceOf(Meal);
      expect(result.name).toBe('Test Meal');
    });

    it('should handle string-encoded meal response', async () => {
      mockedGateway.putMealsByMealId.mockResolvedValue({
        data: { meal: JSON.stringify(mockGoMeal) },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.putMealsByMealId> extends Promise<infer T> ? T : never);

      const result = await updateMeal(1, mockGoMeal);

      expect(result).toBeInstanceOf(Meal);
      expect(result.name).toBe('Test Meal');
    });

    it('should throw error when API returns error object', async () => {
      mockedGateway.putMealsByMealId.mockResolvedValue({
        data: null,
        error: { error: 'Not found' },
      } as unknown as ReturnType<typeof mockedGateway.putMealsByMealId> extends Promise<infer T> ? T : never);

      await expect(updateMeal(1, mockGoMeal)).rejects.toThrow(
        'Failed to update meal: Not found',
      );
    });

    it('should throw error when API returns error string', async () => {
      mockedGateway.putMealsByMealId.mockResolvedValue({
        data: null,
        error: 'Server error',
      } as unknown as ReturnType<typeof mockedGateway.putMealsByMealId> extends Promise<infer T> ? T : never);

      await expect(updateMeal(1, mockGoMeal)).rejects.toThrow(
        'Failed to update meal: Server error',
      );
    });

    it('should throw error when API returns generic error object without error property', async () => {
      mockedGateway.putMealsByMealId.mockResolvedValue({
        data: null,
        error: { status: 500 }, // No 'error' property
      } as unknown as ReturnType<typeof mockedGateway.putMealsByMealId> extends Promise<infer T> ? T : never);

      await expect(updateMeal(1, mockGoMeal)).rejects.toThrow(
        'Failed to update meal: [object Object]',
      );
    });

    it('should handle null error object fallback', async () => {
      mockedGateway.putMealsByMealId.mockResolvedValue({
        data: null,
        error: undefined, // This will cause fallback to 'Unknown error'
      } as unknown as ReturnType<typeof mockedGateway.putMealsByMealId> extends Promise<infer T> ? T : never);

      await expect(updateMeal(1, mockGoMeal)).rejects.toThrow(
        'Failed to update meal: Unknown error',
      );
    });

    it('should throw error when no meal returned', async () => {
      mockedGateway.putMealsByMealId.mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.putMealsByMealId> extends Promise<infer T> ? T : never);

      await expect(updateMeal(1, mockGoMeal)).rejects.toThrow(
        'No meal returned from update request',
      );
    });
  });

  describe('deleteMeal', () => {
    it('should delete meal successfully', async () => {
      mockedGateway.deleteMealsByMealId.mockResolvedValue({
        data: { message: 'Deleted successfully' },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealId> extends Promise<infer T> ? T : never);

      const result = await deleteMeal(1);

      expect(result).toBe('Deleted successfully');
      expect(mockedGateway.deleteMealsByMealId).toHaveBeenCalledWith({
        client: 'mockClient',
        path: { mealId: '1' },
      });
    });

    it('should return default message when no message provided', async () => {
      mockedGateway.deleteMealsByMealId.mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealId> extends Promise<infer T> ? T : never);

      const result = await deleteMeal(1);

      expect(result).toBe('Meal deleted successfully');
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.deleteMealsByMealId.mockResolvedValue({
        data: null,
        error: 'Delete failed',
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealId> extends Promise<infer T> ? T : never);

      await expect(deleteMeal(1)).rejects.toThrow(
        'Failed to delete meal: Delete failed',
      );
    });

    it('should handle null error object fallback', async () => {
      mockedGateway.deleteMealsByMealId.mockResolvedValue({
        data: null,
        error: null, // This will cause fallback to 'Unknown error'
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealId> extends Promise<infer T> ? T : never);

      await expect(deleteMeal(1)).rejects.toThrow(
        'Failed to delete meal: Unknown error',
      );
    });
  });

  describe('updateMealIngredient', () => {
    it('should update ingredient successfully', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: { meal: mockGoMeal },
          error: null,
        } as unknown as ReturnType<typeof mockedGateway.putMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      const result = await updateMealIngredient(1, 1, mockIngredient);

      expect(result).toBeInstanceOf(Meal);
      expect(
        mockedGateway.putMealsByMealIdIngredientsByIngredientId,
      ).toHaveBeenCalledWith({
        client: 'mockClient',
        path: { mealId: '1', ingredientId: '1' },
        body: {
          ingredient: mockIngredient,
          ingredientId: 1,
          mealId: 1,
        },
      });
    });

    it('should handle string-encoded meal response', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: { meal: JSON.stringify(mockGoMeal) },
          error: null,
        } as unknown as ReturnType<typeof mockedGateway.putMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      const result = await updateMealIngredient(1, 1, mockIngredient);

      expect(result).toBeInstanceOf(Meal);
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: null,
          error: 'Update failed',
        } as unknown as ReturnType<typeof mockedGateway.putMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      await expect(updateMealIngredient(1, 1, mockIngredient)).rejects.toThrow(
        'Failed to update ingredient: Update failed',
      );
    });

    it('should throw error when API returns generic error object without error property', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: null,
          error: { code: 400 }, // No 'error' property
        } as unknown as ReturnType<typeof mockedGateway.putMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      await expect(updateMealIngredient(1, 1, mockIngredient)).rejects.toThrow(
        'Failed to update ingredient: [object Object]',
      );
    });

    it('should handle null error object fallback', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: null,
          error: undefined, // This will cause fallback to 'Unknown error'
        } as unknown as ReturnType<typeof mockedGateway.putMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      await expect(updateMealIngredient(1, 1, mockIngredient)).rejects.toThrow(
        'Failed to update ingredient: Unknown error',
      );
    });

    it('should throw error when no meal returned', async () => {
      mockedGateway.putMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: {},
          error: null,
        } as unknown as ReturnType<typeof mockedGateway.putMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      await expect(updateMealIngredient(1, 1, mockIngredient)).rejects.toThrow(
        'No meal returned from update ingredient request',
      );
    });
  });

  describe('createMealIngredient', () => {
    it('should create ingredient successfully', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: { meal: mockGoMeal },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdIngredients> extends Promise<infer T> ? T : never);

      const result = await createMealIngredient(1, mockIngredient);

      expect(result).toBeInstanceOf(Meal);
      expect(mockedGateway.postMealsByMealIdIngredients).toHaveBeenCalledWith({
        client: 'mockClient',
        path: { mealId: '1' },
        body: {
          ingredient: mockIngredient,
          mealId: 1,
        },
      });
    });

    it('should handle string-encoded meal response', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: { meal: JSON.stringify(mockGoMeal) },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdIngredients> extends Promise<infer T> ? T : never);

      const result = await createMealIngredient(1, mockIngredient);

      expect(result).toBeInstanceOf(Meal);
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: null,
        error: 'Creation failed',
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdIngredients> extends Promise<infer T> ? T : never);

      await expect(createMealIngredient(1, mockIngredient)).rejects.toThrow(
        'Failed to create ingredient: Creation failed',
      );
    });

    it('should throw error when API returns generic error object without error property', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: null,
        error: { statusCode: 400 }, // No 'error' property
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdIngredients> extends Promise<infer T> ? T : never);

      await expect(createMealIngredient(1, mockIngredient)).rejects.toThrow(
        'Failed to create ingredient: [object Object]',
      );
    });

    it('should handle null error object fallback', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: null,
        error: undefined, // This will cause fallback to 'Unknown error'
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdIngredients> extends Promise<infer T> ? T : never);

      await expect(createMealIngredient(1, mockIngredient)).rejects.toThrow(
        'Failed to create ingredient: Unknown error',
      );
    });

    it('should throw error when no meal returned', async () => {
      mockedGateway.postMealsByMealIdIngredients.mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdIngredients> extends Promise<infer T> ? T : never);

      await expect(createMealIngredient(1, mockIngredient)).rejects.toThrow(
        'No meal returned from create ingredient request',
      );
    });
  });

  describe('deleteMealIngredient', () => {
    it('should delete ingredient successfully', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: { meal: mockGoMeal },
          error: null,
        } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      const result = await deleteMealIngredient(1, 1);

      expect(result).toBeInstanceOf(Meal);
      expect(
        mockedGateway.deleteMealsByMealIdIngredientsByIngredientId,
      ).toHaveBeenCalledWith({
        client: 'mockClient',
        path: { mealId: '1', ingredientId: '1' },
      });
    });

    it('should handle string-encoded meal response', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: { meal: JSON.stringify(mockGoMeal) },
          error: null,
        } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      const result = await deleteMealIngredient(1, 1);

      expect(result).toBeInstanceOf(Meal);
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: null,
          error: 'Deletion failed',
        } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      await expect(deleteMealIngredient(1, 1)).rejects.toThrow(
        'Failed to delete ingredient: Deletion failed',
      );
    });

    it('should throw error when API returns generic error object without error property', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: null,
          error: { message: 'Delete failed' }, // No 'error' property
        } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      await expect(deleteMealIngredient(1, 1)).rejects.toThrow(
        'Failed to delete ingredient: [object Object]',
      );
    });

    it('should handle null error object fallback', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: null,
          error: undefined, // This will cause fallback to 'Unknown error'
        } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      await expect(deleteMealIngredient(1, 1)).rejects.toThrow(
        'Failed to delete ingredient: Unknown error',
      );
    });

    it('should throw error when no meal returned', async () => {
      mockedGateway.deleteMealsByMealIdIngredientsByIngredientId.mockResolvedValue(
        {
          data: {},
          error: null,
        } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdIngredientsByIngredientId> extends Promise<infer T> ? T : never,
      );

      await expect(deleteMealIngredient(1, 1)).rejects.toThrow(
        'No meal returned from delete ingredient request',
      );
    });
  });

  describe('addBulkSteps', () => {
    it('should add bulk steps successfully', async () => {
      mockedGateway.postMealsByMealIdStepsBulk.mockResolvedValue({
        data: { steps: [mockStep] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdStepsBulk> extends Promise<infer T> ? T : never);

      const instructions = ['Step 1', 'Step 2'];
      const result = await addBulkSteps(1, instructions);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Step);
      expect(mockedGateway.postMealsByMealIdStepsBulk).toHaveBeenCalledWith({
        client: 'mockClient',
        path: { mealId: '1' },
        body: { instructions },
      });
    });

    it('should handle empty steps array', async () => {
      mockedGateway.postMealsByMealIdStepsBulk.mockResolvedValue({
        data: { steps: null },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdStepsBulk> extends Promise<infer T> ? T : never);

      const result = await addBulkSteps(1, ['Step 1']);

      expect(result).toEqual([]);
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.postMealsByMealIdStepsBulk.mockResolvedValue({
        data: null,
        error: 'Add steps failed',
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdStepsBulk> extends Promise<infer T> ? T : never);

      await expect(addBulkSteps(1, ['Step 1'])).rejects.toThrow(
        'Failed to add steps: Add steps failed',
      );
    });

    it('should throw error when API returns generic error object without error property', async () => {
      mockedGateway.postMealsByMealIdStepsBulk.mockResolvedValue({
        data: null,
        error: { details: 'Step creation failed' }, // No 'error' property
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdStepsBulk> extends Promise<infer T> ? T : never);

      await expect(addBulkSteps(1, ['Step 1'])).rejects.toThrow(
        'Failed to add steps: [object Object]',
      );
    });

    it('should handle null error object fallback', async () => {
      mockedGateway.postMealsByMealIdStepsBulk.mockResolvedValue({
        data: null,
        error: undefined, // This will cause fallback to 'Unknown error'
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdStepsBulk> extends Promise<infer T> ? T : never);

      await expect(addBulkSteps(1, ['Step 1'])).rejects.toThrow(
        'Failed to add steps: Unknown error',
      );
    });
  });

  describe('deleteAllSteps', () => {
    it('should delete all steps successfully', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: { message: 'All steps deleted' },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      const result = await deleteAllSteps(1);

      expect(result).toBe('All steps deleted');
      expect(mockedGateway.deleteMealsByMealIdSteps).toHaveBeenCalledWith({
        client: 'mockClient',
        path: { mealId: '1' },
      });
    });

    it('should return default message when no message provided', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      const result = await deleteAllSteps(1);

      expect(result).toBe('Steps deleted successfully');
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: null,
        error: 'Delete steps failed',
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      await expect(deleteAllSteps(1)).rejects.toThrow(
        'Failed to delete steps: Delete steps failed',
      );
    });

    it('should throw error when API returns generic error object without error property', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: null,
        error: { info: 'Steps delete failed' }, // No 'error' property
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      await expect(deleteAllSteps(1)).rejects.toThrow(
        'Failed to delete steps: [object Object]',
      );
    });

    it('should handle null error object fallback', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: null,
        error: undefined, // This will cause fallback to 'Unknown error'
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      await expect(deleteAllSteps(1)).rejects.toThrow(
        'Failed to delete steps: Unknown error',
      );
    });
  });

  describe('replaceAllSteps', () => {
    it('should replace all steps successfully with new steps', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: { message: 'Steps deleted' },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      mockedGateway.postMealsByMealIdStepsBulk.mockResolvedValue({
        data: { steps: [mockStep] },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdStepsBulk> extends Promise<infer T> ? T : never);

      const newSteps = [new Step({ instruction: 'New step 1' })];

      await replaceAllSteps(1, newSteps);

      expect(mockedGateway.deleteMealsByMealIdSteps).toHaveBeenCalled();
      expect(mockedGateway.postMealsByMealIdStepsBulk).toHaveBeenCalled();
    });

    it('should only delete steps when empty steps array provided', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: { message: 'Steps deleted' },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      await replaceAllSteps(1, []);

      expect(mockedGateway.deleteMealsByMealIdSteps).toHaveBeenCalled();
      expect(mockedGateway.postMealsByMealIdStepsBulk).not.toHaveBeenCalled();
    });

    it('should propagate delete error', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: null,
        error: 'Delete failed',
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      const newSteps = [new Step({ instruction: 'New step 1' })];

      await expect(replaceAllSteps(1, newSteps)).rejects.toThrow(
        'Failed to delete steps: Delete failed',
      );
    });

    it('should propagate add steps error', async () => {
      mockedGateway.deleteMealsByMealIdSteps.mockResolvedValue({
        data: { message: 'Steps deleted' },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.deleteMealsByMealIdSteps> extends Promise<infer T> ? T : never);

      mockedGateway.postMealsByMealIdStepsBulk.mockResolvedValue({
        data: null,
        error: 'Add failed',
      } as unknown as ReturnType<typeof mockedGateway.postMealsByMealIdStepsBulk> extends Promise<infer T> ? T : never);

      const newSteps = [new Step({ instruction: 'New step 1' })];

      await expect(replaceAllSteps(1, newSteps)).rejects.toThrow(
        'Failed to add steps: Add failed',
      );
    });
  });

  describe('goGetShoppingList', () => {
    it('should generate shopping list successfully', async () => {
      const mockShoppingListItems = [
        { ingredient: 'Tomatoes', quantity: 2, unit: 'lbs' },
        { ingredient: 'Onions', quantity: 1, unit: 'piece' },
      ];

      mockedGateway.postShoppinglist.mockResolvedValue({
        data: { items: mockShoppingListItems },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postShoppinglist> extends Promise<infer T> ? T : never);

      const mockMealPlan = new MealPlan({
        items: [
          new MealPlanItem({
            dayIndex: 0,
            mealType: MealSlot.LUNCH,
            mealId: 1,
            mealSnapshot: new Meal({ id: 1, name: 'Meal 1' }),
          }),
          new MealPlanItem({
            dayIndex: 1,
            mealType: MealSlot.DINNER,
            mealId: 2,
            mealSnapshot: new Meal({ id: 2, name: 'Meal 2' }),
          }),
        ],
      });

      const result = await goGetShoppingList(mockMealPlan);

      expect(result).toEqual(mockShoppingListItems);
      expect(mockedGateway.postShoppinglist).toHaveBeenCalledWith({
        client: 'mockClient',
        body: { plan: [1, 2] },
      });
    });

    it('should throw error when API returns error', async () => {
      mockedGateway.postShoppinglist.mockResolvedValue({
        data: null,
        error: 'Shopping list generation failed',
      } as unknown as ReturnType<typeof mockedGateway.postShoppinglist> extends Promise<infer T> ? T : never);

      const mockMealPlan = new MealPlan({
        items: [
          new MealPlanItem({
            dayIndex: 0,
            mealType: MealSlot.DINNER,
            mealSnapshot: new Meal({ id: 1, name: 'Meal 1' }),
          }),
        ],
      });

      await expect(goGetShoppingList(mockMealPlan)).rejects.toThrow(
        'Failed to generate shopping list: Shopping list generation failed',
      );
    });

    it('should throw error when no items returned', async () => {
      mockedGateway.postShoppinglist.mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postShoppinglist> extends Promise<infer T> ? T : never);

      const mockMealPlan = new MealPlan({
        items: [
          new MealPlanItem({
            dayIndex: 0,
            mealType: MealSlot.BREAKFAST,
            mealSnapshot: new Meal({ id: 1, name: 'Meal 1' }),
          }),
        ],
      });

      await expect(goGetShoppingList(mockMealPlan)).rejects.toThrow(
        'Failed to generate shopping list: Unknown error',
      );
    });

    it('should handle meal plan with no meals', async () => {
      const mockShoppingListItems: unknown[] = [];

      mockedGateway.postShoppinglist.mockResolvedValue({
        data: { items: mockShoppingListItems },
        error: null,
      } as unknown as ReturnType<typeof mockedGateway.postShoppinglist> extends Promise<infer T> ? T : never);

      const mockMealPlan = new MealPlan({ items: [] });

      const result = await goGetShoppingList(mockMealPlan);

      expect(result).toEqual([]);
      expect(mockedGateway.postShoppinglist).toHaveBeenCalledWith({
        client: 'mockClient',
        body: { plan: [] },
      });
    });
  });
});
