# Meal Planner Frontend

This directory contains the frontend React application for the Meal Planner.

## Technology Stack

- React with TypeScript
- Material UI for components
- Jest and React Testing Library for tests
- Native fetch API for data fetching

## Project Structure

- `src/` - Source code
  - `components/` - React components
  - `types.ts` - TypeScript type definitions
  - `App.tsx` - Main application component
  - `*.test.tsx` - Test files for corresponding components
  - `test-utils.tsx` - Test utilities and helper functions

## Testing Strategy

The frontend tests follow these principles:

1. **Component Testing**: Each major component has a corresponding test file that verifies its functionality.
2. **Reusable Test Utilities**: Common test utilities are centralized in `test-utils.tsx` to promote code reuse and consistency.
3. **Mocked API Calls**: API calls are mocked using Jest's mock functions to isolate component testing from backend dependencies.
4. **Use of Actual Components**: Tests use the actual component implementations whenever possible, minimizing custom mock components.
5. **DRY Principles**: Tests avoid duplication of mock data and setup code across test files.

## Running Tests

```bash
# Run all frontend tests
yarn test

# Run tests with coverage
yarn coverage

# Run tests in watch mode during development
yarn test:watch
```

## Development

```bash
# Start the frontend development server
yarn start
```

## Maintenance Notes

- Data fetching is standardized using the native fetch API throughout the application.
- The test utilities provide common mock data and helper functions to make tests more maintainable.
- When adding new components, follow the pattern of creating corresponding test files. 