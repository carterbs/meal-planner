# `ui` – React web application

## Purpose

The `ui` package contains the React front‑end for the Meal Planner system.
It presents a user interface for creating meal plans, browsing recipes,
managing preferences and interacting with the agent service.  The UI
communicates with the backend via the API gateway and gRPC‑web/HTTP
clients generated from the proto definitions.

## Technology stack
* **Yarn** We use yarn for package management.
* **React 18** with functional components and hooks.  Avoid class
  components unless absolutely necessary.
* **Vite** for development server and bundling.
* **Material UI (MUI)** for components and styling.  Use the
  preconfigured theme and avoid inline styles.
* **React Router** for client‑side routing.
* **TypeScript** – Strictly typed; no usage of `any`.
* **Jest** for unit tests.

## Directory structure

* `src/`
  * `components/` – Reusable presentational components.  Components
    should be small, pure and accept props typed with interfaces.
  * `pages/` – Top‑level route components corresponding to URL paths.
  * `hooks/` – Custom React hooks for encapsulating reusable logic (e.g.
    data fetching, form handling).
  * `services/` – API clients generated from `proto` definitions or
    handwritten wrappers around the API gateway.  Do not write API
    calls inline in components.
  * `contexts/` – React context providers for global state (e.g.
    authentication, theme).
  * `theme/` – MUI theme configuration.
* `public/` – Static assets and the root `index.html` used by Vite.

## Development commands

Use the validate tool from the repository root for testing, linting, and building:

* `yarn test --service ui` – Run unit tests
* `yarn lint --service ui` – Run ESLint and Prettier
* `yarn build --service ui` – Build the production bundle

For development, run from this directory:
* `yarn install` – Install dependencies
* `yarn dev` – Start the Vite development server with HMR

## Implementation guidelines

1. **No `any`.**  All components, hooks and services must have explicit
   TypeScript types.  Use generics and utility types to capture complex
   props.
2. **Component composition.**  Break pages into small reusable
   components.  Prefer composition over inheritance.  Use MUI
   components and follow accessibility best practices.
3. **State management.**  Use React context sparingly.  For local state
   use `useState` or `useReducer`.  For global state (e.g. authenticated
   user), create a context with a provider.
4. **Data fetching.**  Encapsulate API calls into files in src/api.
5. **Testing philosophy.**  Write unit tests for components and hooks.
   Tests should focus on user‑visible behaviour, not internal
   implementation.  Avoid testing mocks; render the component and assert
   on the DOM.
6. **Plan mode for features.**  When building a new page or feature,
   outline the user flow, API interactions and components needed before
   coding.
7. **Styling.**  Use the MUI theming system (`createTheme`) to define
   colours, typography and spacing.  Do not override MUI styles with
   arbitrary CSS; extend the theme instead.
8. **Accessibility.**  All interactive elements must have accessible
   labels.  Use semantic HTML and ARIA attributes where necessary.
9. **Error boundaries.**  Wrap top‑level routes or components with
   React error boundaries to catch rendering errors.

## Adding a new page

1. Create a file under `src/pages/` for your page.  Export a default
   component typed with `FC` (FunctionComponent).
2. Fetch data in a custom hook (in `src/hooks/`) and handle 
   loading/error states.
3. Compose reusable components from `src/components/` or create new
   ones as needed.
   navigation components.
4. Write tests covering user interactions and error states.
5. Run `yarn test lint build --service ui` from the root directory before committing.
6. Update this `CLAUDE.md` if you introduce new patterns or utilities.