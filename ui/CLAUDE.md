# UI Development Guidelines

## TypeScript Guidelines
- **NEVER use `any` type** - Always use proper typing, interfaces, or type unions
- Use strict TypeScript configuration
- Prefer type assertions only when absolutely necessary with proper justification

## Testing
- Run tests with: `yarn test`  
- Watch tests with: `yarn test:watch`
- Generate coverage: `yarn coverage`
- All components should have corresponding test files

## Development Commands
- Start dev server: `yarn start`
- Build production: `yarn build`
- Proxy configured for backend at `http://localhost:8090`

## Code Quality & Dead Code Detection
- Lint code: `yarn lint`
- Auto-fix lint issues: `yarn lint:fix`
- Find unused exports: `yarn dead-code`
- Combined dead code check: `yarn dead-code:check`

## Framework & Libraries
- React 18 with TypeScript
- Material-UI (MUI) with custom theme following "crunchy mom aesthetic"
- Connect-RPC for gRPC communication
- React Testing Library for tests
- Date-fns for date handling

## Code Style
- Use functional components with hooks
- Follow existing theme patterns in `src/theme.tsx`
- Keep components focused and single-responsibility
- Use MUI system for consistent styling