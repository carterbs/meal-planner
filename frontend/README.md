# Meal Planner Frontend

This directory contains the React + TypeScript application.

## Technology Stack
- React 18
- Material UI
- Jest and React Testing Library
- Native `fetch` for all API calls

## Structure
- `src/` – Application source
  - `components/` – Shared UI components
  - `test-utils.tsx` – Helpers used across tests
  - `types.ts` – Shared TypeScript types

## Testing
```bash
# All frontend tests
yarn test

# With coverage
yarn coverage

# Watch mode
yarn test:watch
```

## Development
```bash
# Start only the frontend server
yarn start
```

## Notes
- Keep data fetching with `fetch` for consistency.
- Add a matching `*.test.tsx` file when creating new components.
- See the repo [README](../README.md) for project-wide details.
