import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { Meal, WeeklyMealPlan, Ingredient } from './types';

// Extended meal plan interface for the new structure
interface ExtendedMealPlan {
  [day: string]: {
    [mealType: string]: Meal | null;
  };
}

// Shared mock data for tests - updated to new structure
export const mockMealPlan: ExtendedMealPlan = {
  Monday: {
    Breakfast: {
      id: 0,
      name: 'Test Meal 1',
      effort: 2,
      
      hasRedMeat: false,
      mealType: 'breakfast',
      url: '',
      ingredients: [
        { id: 0, mealId: 0, name: 'Ingredient 1', quantity: 2, unit: 'cups' },
      ],
      steps: [],
    },
    Lunch: null,
    Dinner: {
      id: 0,
      name: 'Test Meal 2',
      effort: 3,
      
      hasRedMeat: true,
      mealType: 'dinner',
      url: '',
      ingredients: [
        { id: 0, mealId: 0, name: 'Ingredient 2', quantity: 1, unit: 'tbsp' },
      ],
      steps: [],
    },
  },
  Tuesday: {
    Breakfast: null,
    Lunch: {
      id: 0,
      name: 'Test Lunch Meal',
      effort: 1,
      
      hasRedMeat: false,
      mealType: 'lunch',
      url: '',
      ingredients: [],
      steps: [],
    },
    Dinner: {
      id: 0,
      name: 'Test Dinner Meal',
      effort: 2,
      
      hasRedMeat: false,
      mealType: 'dinner',
      url: '',
      ingredients: [],
      steps: [],
    },
  },
  Wednesday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
  Thursday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
  Friday: {
    Breakfast: null,
    Lunch: null,
    Dinner: {
      id: 5,
      name: 'Eating out',
      effort: 1,
      
      hasRedMeat: false,
      mealType: 'dinner',
      url: '',
      ingredients: [],
      steps: [],
    },
  },
  Saturday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
  Sunday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
};

// Keep the old mockMealPlan for backward compatibility with tests that still expect the old format
export const mockMealPlanLegacy = {
  days: [
    {
      dayIndex: 0,
      mealType: 'dinner',
      meal: {
        id: 0,
        name: 'Test Meal 1',
        effort: 2,
        
        hasRedMeat: false,
        mealType: 'dinner',
        url: '',
        ingredients: [
          { id: 0, mealId: 0, name: 'Ingredient 1', quantity: 2, unit: 'cups' },
        ],
        steps: [],
      },
    },
    {
      dayIndex: 1,
      mealType: 'dinner',
      meal: {
        id: 0,
        name: 'Test Meal 2',
        effort: 3,
        
        hasRedMeat: true,
        mealType: 'dinner',
        url: '',
        ingredients: [
          { id: 0, mealId: 0, name: 'Ingredient 2', quantity: 1, unit: 'tbsp' },
        ],
        steps: [],
      },
    },
    {
      dayIndex: 4,
      mealType: 'dinner',
      meal: {
        id: 0,
        name: 'Eating out',
        effort: 1,
        
        hasRedMeat: false,
        mealType: 'dinner',
        url: '',
        ingredients: [],
        steps: [],
      },
    },
  ],
  shoppingList: [],
} as unknown as WeeklyMealPlan;

export const mockAvailableMeals: Meal[] = [
  {
    id: 0,
    url: '',
    steps: [],
    name: 'Available Test Meal',
    effort: 2,
    
    hasRedMeat: false,
    mealType: 'breakfast',
    ingredients: [],
  },
  {
    id: 0,
    url: '',
    steps: [],
    name: 'Another Available Meal',
    effort: 1,
    
    hasRedMeat: true,
    mealType: 'breakfast',
    ingredients: [],
  },
];

export const mockShoppingList: Ingredient[] = [
  { id: 0, mealId: 0, name: 'Ingredient 1', quantity: 2, unit: 'cups' },
  { id: 0, mealId: 0, name: 'Ingredient 2', quantity: 1, unit: 'tbsp' },
];

// Helper function to setup common fetch mocks
export const setupFetchMocks = (options?: {
  mealPlan?: ExtendedMealPlan;
  availableMeals?: Meal[];
  shoppingList?: Ingredient[];
  customMocks?: Record<string, any>;
}) => {
  const mocks = {
    mealPlan: options?.mealPlan || mockMealPlan,
    availableMeals: options?.availableMeals || mockAvailableMeals,
    shoppingList: options?.shoppingList || mockShoppingList,
    ...options?.customMocks,
  };

  global.fetch = jest.fn((url: RequestInfo) => {
    const urlStr = url.toString();

    if (
      urlStr.includes('/api/mealplan') &&
      !urlStr.includes('replace') &&
      !urlStr.includes('generate') &&
      !urlStr.includes('finalize')
    ) {
      // Always return the ExtendedMealPlan structure
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mocks.mealPlan),
      } as Response);
    }

    if (urlStr.includes('/api/mealplan/generate')) {
      // Return the ExtendedMealPlan structure for generate endpoint
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mocks.mealPlan),
      } as Response);
    }

    if (urlStr.includes('/api/meals') && !urlStr.includes('swap')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mocks.availableMeals),
      } as Response);
    }

    if (urlStr.includes('/api/shoppinglist')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mocks.shoppingList),
      } as Response);
    }

    if (urlStr.includes('/api/meals/swap')) {
      // Return a new meal for swap operations
      const newMeal = {
        id: 0,
        name: 'Swapped Test Meal',
        effort: 1,
        
        hasRedMeat: false,
        mealType: 'dinner',
        url: '',
        ingredients: [],
        steps: [],
      };
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(newMeal),
      } as Response);
    }

    if (urlStr.includes('/api/health') || urlStr.includes('/api/reconnect')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      } as Response);
    }

    // Default response for other endpoints
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  }) as jest.Mock;

  return global.fetch;
};

// Cleanup function to reset fetch mocks
export const cleanupFetchMocks = () => {
  jest.restoreAllMocks();
};

// Custom render function for components that need context providers
export function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { ...options });
}

// Shared test utilities for common testing patterns

// Mock WebSocket for agent connection tests
export const mockWebSocket = () => {
  const mockWS = {
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: WebSocket.OPEN,
  };
  
  (global as any).WebSocket = jest.fn(() => mockWS);
  return mockWS;
};

// Mock clipboard API
export const mockClipboard = () => {
  const mockClipboard = {
    writeText: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
  };
  
  Object.defineProperty(navigator, 'clipboard', {
    value: mockClipboard,
    writable: true,
  });
  
  return mockClipboard;
};

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  const mockStorage = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
  
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
  
  return { mockStorage, store };
};

// Shared user event utilities
export const userEvents = {
  clickElement: async (element: HTMLElement) => {
    const userEvent = (await import('@testing-library/user-event')).default;
    await userEvent.click(element);
  },
  
  typeText: async (element: HTMLElement, text: string) => {
    const userEvent = (await import('@testing-library/user-event')).default;
    await userEvent.type(element, text);
  },
  
  pressKey: async (element: HTMLElement, key: string) => {
    const userEvent = (await import('@testing-library/user-event')).default;
    await userEvent.type(element, `{${key}}`);
  },
  
  hoverElement: async (element: HTMLElement) => {
    const userEvent = (await import('@testing-library/user-event')).default;
    await userEvent.hover(element);
  },
};

// Mock session data for testing
export const mockSessionData = {
  threadId: 'test-thread-123',
  currentStep: 'planning',
  mealPlan: mockMealPlan,
  shoppingList: mockShoppingList,
};

// Error simulation utilities
export const errorUtils = {
  networkError: () => new Error('Network Error'),
  timeoutError: () => new Error('Request timeout'),
  validationError: (field: string) => new Error(`Validation failed for ${field}`),
};

// Loading state utilities
export const loadingUtils = {
  simulateDelay: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  mockLoadingFetch: (delay: number = 100) => {
    return jest.fn().mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({}),
        }), delay)
      )
    );
  },
};

// Accessibility test utilities
export const a11yUtils = {
  hasAriaLabel: (element: HTMLElement, label: string) => 
    element.getAttribute('aria-label') === label,
    
  hasAriaRole: (element: HTMLElement, role: string) => 
    element.getAttribute('role') === role,
    
  isFocusable: (element: HTMLElement) => 
    element.tabIndex >= 0 || ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'].includes(element.tagName),
};

// Drag and drop test utilities
export const dragDropUtils = {
  mockDragEvent: (dataTransfer?: Partial<DataTransfer>) => ({
    dataTransfer: {
      setData: jest.fn(),
      getData: jest.fn(),
      ...dataTransfer,
    },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  }),
  
  simulateDragDrop: async (source: HTMLElement, target: HTMLElement) => {
    const userEvent = (await import('@testing-library/user-event')).default;
    // This is a simplified drag-drop simulation
    // In real tests, you might need more complex DnD library mocking
    const dragStartEvent = new Event('dragstart', { bubbles: true });
    const dropEvent = new Event('drop', { bubbles: true });
    
    source.dispatchEvent(dragStartEvent);
    target.dispatchEvent(dropEvent);
  },
};

// Re-export everything from testing-library
export * from '@testing-library/react';
