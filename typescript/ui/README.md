# Meal Planner UI

## Overview
The UI module provides the React/TypeScript frontend for the Meal Planner application. It is built with [React](https://react.dev) and [Material-UI (MUI)](https://mui.com) and communicates with the Go backend over REST APIs. This document explains the architecture, major features, and developer workflow for the UI.

## Application Architecture

### Directory Layout

- **`src/`** – Main source code
  - **`index.tsx`** – entry point which renders `AgentPage` inside a MUI `ThemeProvider`.
  - **`theme.tsx`** – application theme implementing the "crunchy mom" style guide.
  - **`App.tsx`** and **`AgentPage.tsx`** – top level views. `AgentPage` is the active page that integrates chat-based meal planning.
  - **`components/`** – reusable UI components such as `MealPlanTab`, `MealManagementTab`, `MealPlanDisplay`, `StepsEditor`, etc.
  - **`hooks/`** – custom React hooks (e.g. `useSession`).
  - **`types.ts`** – TypeScript types shared across components.
  - **`test-utils.tsx`** – helpers and mock data used by tests.

### Component Hierarchy

`index.tsx` mounts `AgentPage` wrapped in the application theme. `AgentPage` contains two major panes:

1. **Chat Interface** – allows the user to converse with the meal planning agent. Messages are stored in local component state. The agent may return a meal plan or shopping list which updates the right pane.
2. **Meal Plan Display** – shows the weekly plan using `MealPlanDisplay` and, when available, a shopping list accordion.

`App.tsx` implements an older two-tab interface with `MealPlanTab` and `MealManagementTab`. It remains in the code base for reference. Both tabs rely on smaller components:

- **`MealPlanTab`** – handles generation, editing, skipping, and finalizing of meal plans as well as shopping list generation.
- **`MealManagementTab`** – CRUD interface for recipes using MUI `DataGrid`.
- **`AddRecipeForm`** and **`StepsEditor`** – forms to add recipes and manage step-by-step instructions with drag‑and‑drop reordering.

### State Management and Data Flow

The application uses React `useState` and `useEffect` hooks for state. There is no global store. API calls are made via `fetch` and results update local state within each component. Key patterns:

- Meal plan and shopping list state live in `MealPlanTab`/`AgentPage` and are passed down as props.
- Actions such as generate, finalize, or update meals trigger REST calls and update state on success.
- `useSession` persists the current workflow in `localStorage` and resumes sessions on page load.

### Routing and Navigation

There is no client-side router; `index.tsx` renders a single page (`AgentPage`). `App.tsx` previously used a tabbed interface for navigation but the application now focuses on the conversational workflow.

### UI/UX and Design System

Styling is provided by `theme.tsx` which follows the `typescript/style-guide.md` palette and typography. Components use MUI primitives with custom gradients, rounded corners and subtle animations. The layout adapts for smaller screens via MUI's responsive utilities and grid system.

## Features & Functionality

### Meal Planning Workflow

- **Generate Plan** – create a weekly plan via `/api/mealplan/generate`.
- **Skip Days/Meals** – temporarily exclude days or individual meals.
- **Update Meals** – swap meals using `MealAutocomplete` to choose from available recipes.
- **Finalize Plan** – send the current plan to `/api/mealplan/finalize`.
- **Copy Plan/Shopping List** – copy formatted tables or plain text to the clipboard.
- **Add to Calendar** – download an ICS feed for import into Google Calendar.

### Recipe Management

- View recipes in a table with last planned date, effort and red meat indicator.
- Add new recipes with `AddRecipeForm` which supports bulk ingredient parsing, automatic quantity doubling and step management with `StepsEditor`.
- Edit or delete recipes and individual ingredients inline.

### Shopping List

- Automatically generated whenever the meal plan changes using `/api/shoppinglist`.
- Users can remove ingredients from the generated list or copy the list to the clipboard.

### Responsive & Accessibility Considerations

The MUI component library provides baseline accessibility features and keyboard navigation. Layouts use MUI's responsive grid so the UI remains usable on narrow screens. Color contrast and font sizes follow the custom theme to maintain readability.

## Development & Testing

### Getting Started

1. Start the backend:
   ```bash
   cd backend && go run main.go --dummy
   ```
2. Run the frontend:
   ```bash
   cd typescript/ui && yarn start
   ```

### Testing

Tests are written with React Testing Library and Jest. Run all project tests from the repository root:

```bash
yarn test
```

Component tests live next to their source files (e.g. `MealPlanTab.test.tsx`). `jest-fetch-mock` is used to stub network requests.

### Styling and Debugging

- Follow the guidelines in `typescript/style-guide.md` for colors, typography and spacing.
- `theme.tsx` centralizes visual customization.
- Use React DevTools and browser debugging tools to inspect component state and network requests.

### Build and Deployment

The app uses `react-scripts`:

```bash
yarn build
```

This outputs a production build to `typescript/ui/build`. The Docker setup in the repository serves the compiled frontend alongside the Go backend.

## Contributing

1. Make code changes following the existing patterns.
2. Add or update tests as needed.
3. Run `yarn test` and ensure all suites pass.
4. Commit your changes via `git`.

This README should provide enough context for developers to understand how the React frontend is organized and how to extend it.
