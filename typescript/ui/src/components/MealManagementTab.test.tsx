import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '../test-utils';
import { MealManagementTab } from './MealManagementTab';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { setupFetchMocks, cleanupFetchMocks } from '../test-utils';

// Mock the generated gateway client
jest.mock('@mealplanner/generated/dist/gateway/index.js', () => ({
  getMeals: jest.fn(),
  postMeals: jest.fn(),
  deleteMealsByMealId: jest.fn(),
  putMealsByMealIdIngredientsByIngredientId: jest.fn(),
  deleteMealsByMealIdIngredientsByIngredientId: jest.fn(),
  postMealsByMealIdStepsBulk: jest.fn(),
  deleteMealsByMealIdSteps: jest.fn(),
}));

// Mock the client creation
jest.mock('@mealplanner/generated/dist/gateway/client/index.js', () => ({
  createClient: jest.fn(() => ({})),
  createConfig: jest.fn(() => ({})),
}));

import {
  getMeals,
  postMeals,
  deleteMealsByMealId,
  putMealsByMealIdIngredientsByIngredientId,
  deleteMealsByMealIdIngredientsByIngredientId,
  postMealsByMealIdStepsBulk,
  deleteMealsByMealIdSteps,
} from '@mealplanner/generated/dist/gateway/index.js';

const mockGetMeals = getMeals as jest.MockedFunction<typeof getMeals>;
const mockPostMeals = postMeals as jest.MockedFunction<typeof postMeals>;
const mockDeleteMeal = deleteMealsByMealId as jest.MockedFunction<
  typeof deleteMealsByMealId
>;
const mockUpdateIngredient =
  putMealsByMealIdIngredientsByIngredientId as jest.MockedFunction<
    typeof putMealsByMealIdIngredientsByIngredientId
  >;
const mockDeleteIngredient =
  deleteMealsByMealIdIngredientsByIngredientId as jest.MockedFunction<
    typeof deleteMealsByMealIdIngredientsByIngredientId
  >;
const mockPostStepsBulk = postMealsByMealIdStepsBulk as jest.MockedFunction<
  typeof postMealsByMealIdStepsBulk
>;
const mockDeleteSteps = deleteMealsByMealIdSteps as jest.MockedFunction<
  typeof deleteMealsByMealIdSteps
>;

// We still need to mock the DataGrid component as it's complex and has virtual scrolling behavior
jest.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns, onRowClick }: any) => (
    <div data-testid="mock-data-grid">
      {rows &&
        rows.length > 0 &&
        rows.map((row: any, index: number) => (
          <div
            key={`meal-${row.id || index}`}
            data-testid={`meal-row-${row.id || index}`}
          >
            <button onClick={() => onRowClick && onRowClick({ id: row.id })}>
              {row.name}
            </button>
          </div>
        ))}
    </div>
  ),
}));

const mockMeals = [
  {
    id: 1,
    name: 'Test Meal',
    effort: 2,
    hasRedMeat: false,
    url: '',
    mealType: 'dinner',
    ingredients: [
      {
        id: 1,
        mealId: 1,
        name: 'Test Ingredient',
        quantity: 1,
        unit: 'cup',
      },
    ],
    steps: [
      {
        id: 1,
        mealId: 1,
        stepNumber: 1,
        instruction: 'Test instruction',
      },
    ],
  },
];

const mockGatewayMeals = [
  {
    id: 1,
    name: 'Test Meal',
    effort: 2,
    hasRedMeat: false,
    url: '',
    mealType: 'dinner',
    ingredients: [
      {
        id: 1,
        mealId: 1,
        name: 'Test Ingredient',
        quantity: 1,
        unit: 'cup',
      },
    ],
    steps: [
      {
        id: 1,
        mealId: 1,
        stepNumber: 1,
        instruction: 'Test instruction',
      },
    ],
  },
];

describe('MealManagementTab', () => {
  const mockShowToast = jest.fn();

  beforeEach(() => {
    // Mock the gateway functions
    mockGetMeals.mockResolvedValue({
      data: { meals: mockGatewayMeals },
      error: null,
    } as any);

    mockPostMeals.mockResolvedValue({
      data: mockGatewayMeals[0],
      error: null,
    } as any);

    mockDeleteMeal.mockResolvedValue({
      data: {},
      error: null,
    } as any);

    mockUpdateIngredient.mockResolvedValue({
      data: {},
      error: null,
    } as any);

    mockDeleteIngredient.mockResolvedValue({
      data: {},
      error: null,
    } as any);

    mockPostStepsBulk.mockResolvedValue({
      data: {},
      error: null,
    } as any);

    mockDeleteSteps.mockResolvedValue({
      data: {},
      error: null,
    } as any);

    mockShowToast.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('loads and displays main menu with cards', async () => {
    await act(async () => {
      render(<MealManagementTab showToast={mockShowToast} />);
    });

    // Verify main cards are shown
    expect(screen.getByText('Browse Meals')).toBeInTheDocument();
    expect(screen.getByText('Add New Recipe')).toBeInTheDocument();
    expect(screen.getByText('Meal Library')).toBeInTheDocument();
  });

  test('navigates to browse meals view and displays meal details', async () => {
    await act(async () => {
      render(<MealManagementTab showToast={mockShowToast} />);
    });

    // Click the Browse Meals card
    await act(async () => {
      fireEvent.click(screen.getByText('Browse Meals'));
    });

    // Wait for meals to load
    await waitFor(() => {
      expect(screen.getByText('Test Meal')).toBeInTheDocument();
    });

    // Click on the meal to show details
    await act(async () => {
      fireEvent.click(screen.getByText('Test Meal'));
    });

    // Verify meal details are shown (the component should display the meal details)
    await waitFor(() => {
      expect(screen.getByText('Meal Details')).toBeInTheDocument();
    });
  });

  test('loads meals from API on browse view', async () => {
    await act(async () => {
      render(<MealManagementTab showToast={mockShowToast} />);
    });

    // Navigate to browse meals
    await act(async () => {
      fireEvent.click(screen.getByText('Browse Meals'));
    });

    // Wait for API call to be made
    await waitFor(() => {
      expect(mockGetMeals).toHaveBeenCalledWith({
        client: {},
        query: undefined,
      });
    });

    // Verify meals are displayed
    expect(screen.getByText('Test Meal')).toBeInTheDocument();
  });

  test('handles API error when loading meals', async () => {
    // Mock an error response
    mockGetMeals.mockRejectedValueOnce(new Error('API Error'));

    await act(async () => {
      render(<MealManagementTab showToast={mockShowToast} />);
    });

    // Navigate to browse meals
    await act(async () => {
      fireEvent.click(screen.getByText('Browse Meals'));
    });

    // Wait for error toast to be shown
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Error fetching meals');
    });
  });

  test('navigates to add recipe view', async () => {
    await act(async () => {
      render(<MealManagementTab showToast={mockShowToast} />);
    });

    // Click the Add New Recipe card
    await act(async () => {
      fireEvent.click(screen.getByText('Add New Recipe'));
    });

    // Verify we navigated to the add recipe view by checking for the form
    await waitFor(() => {
      expect(document.querySelector('form')).toBeInTheDocument();
    });
  });

  test('navigates back to main menu', async () => {
    await act(async () => {
      render(<MealManagementTab showToast={mockShowToast} />);
    });

    // Click the Browse Meals card
    await act(async () => {
      fireEvent.click(screen.getByText('Browse Meals'));
    });

    // Click the back button
    await act(async () => {
      fireEvent.click(screen.getByLabelText('back to main menu'));
    });

    // Verify we returned to the main menu
    expect(screen.getByText('Meal Library')).toBeInTheDocument();
    expect(screen.getByText('Browse Meals')).toBeInTheDocument();
    expect(screen.getByText('Add New Recipe')).toBeInTheDocument();
  });
});
