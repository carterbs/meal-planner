# Meal Planner React UI

This package implements the React frontend for the Meal Planner application. The code lives in `typescript/ui` and is built with [Create React App](https://create-react-app.dev/) using TypeScript and [Material UI](https://mui.com/).

## Architecture

### Project Structure

```
typescript/ui/
├── public/             # Static assets and index.html
├── src/
│   ├── components/     # Reusable presentational components
│   ├── hooks/          # Custom React hooks
│   ├── AddRecipeForm.tsx
│   ├── AgentPage.tsx   # Conversational agent experience
│   ├── App.tsx         # Meal planner dashboard
│   ├── index.tsx       # Entry point
│   └── theme.tsx       # MUI theme following the style guide
└── package.json
```

`index.tsx` attaches the application to the DOM and wraps all pages with the global Material UI theme defined in `src/theme.tsx`. The entry renders the `AgentPage` component which provides a conversational experience for generating meal plans. The classic dashboard (`App.tsx`) is also provided and can be rendered if needed.

### Component Hierarchy

The main dashboard is composed as follows:

```
App
├── MealPlanTab        # Weekly planner and shopping list
│   └── MealAutocomplete
├── MealManagementTab  # Browse and edit saved recipes
│   └── StepsEditor
└── Toast              # Global notifications
```

`AgentPage` is a standalone page used when chatting with the meal‑planning agent. It displays a chat history on the left and the generated meal plan / shopping list on the right.

### State Management and Data Flow

React state is managed locally within components using hooks (`useState`, `useEffect`, etc.). Data is loaded from the Go backend via `fetch` calls. Components lift important state (such as the weekly meal plan) up to their parents so sibling components remain in sync. The application does not use a global state library.

### Routing and Navigation

Client side routing is minimal. `index.tsx` always renders `AgentPage`; tests show it can conditionally render other pages if the browser path changes. Inside the dashboard (`App.tsx`) a simple tab interface from MUI controls navigation between the meal‑planning view and recipe management view.

### Design System

The UI follows the "crunchy mom" aesthetic described in `typescript/style-guide.md` and is implemented through the custom MUI theme defined in `src/theme.tsx`. The palette centers on sage greens and earth tones with generous use of gradients and rounded corners.

## Features

### Meal Planning

* Generate a weekly plan or edit meals manually
* Skip individual meals or whole days
* Automatically build a shopping list for the visible meals
* Copy either the meal plan or shopping list to the clipboard
* Export the plan as an ICS calendar file

### Recipe Management

* Browse existing recipes with filtering and search
* View detailed ingredients and preparation steps
* Add new recipes using `AddRecipeForm` including bulk step entry
* Edit or delete existing meals and their ingredients

### Chat Based Planning

`AgentPage` lets users chat with the planning agent. Messages are sent to `/api/agent` endpoints and responses may update the `MealPlanDisplay` component or shopping list. The layout adapts to narrow screens so the chat remains usable on mobile devices.

### Accessibility & Responsiveness

The UI relies on Material UI components which provide baseline accessibility features such as keyboard navigation and ARIA labels. Layouts use responsive CSS properties so the planner is usable on a wide range of screen sizes.

## Development

### Setup

Install dependencies from the repository root:

```bash
yarn install
cd typescript/shared && yarn build    # build shared utilities used by tests
```

### Running in Development

```bash
cd typescript/ui
yarn start
```

This launches `react-scripts` with hot‑reloading and proxies API requests to `localhost:8080`.

### Testing

Comprehensive unit tests are written with Jest and React Testing Library. Run all project tests from the repository root:

```bash
yarn test
```

To run only the UI tests use `yarn test:frontend`. Code that interacts with the backend is mocked via helpers in `src/test-utils.tsx`.

### Building for Production

```bash
cd typescript/ui
yarn build
```

Static files are emitted to `build/`. Deployment is handled by Docker and the root `docker-compose.yml` file.

### Debugging

The application uses standard browser dev tools. Since API calls are plain `fetch` requests, network activity can be inspected directly in the dev tools. For styling tweaks refer to the theme definitions in `src/theme.tsx` and the guidelines in `typescript/style-guide.md`.

## Contributing

1. Follow the architecture and style guidelines in this document and `style-guide.md`.
2. Ensure all tests pass via `yarn test` before committing.
3. Keep components focused and well tested so other developers can extend the UI confidently.

