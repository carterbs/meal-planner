# Meal Planner UI

React-based frontend for the Meal Planner application providing an AI-powered meal planning experience.

## What It Does

- Chat interface with AI agent for meal planning conversations
- Visual meal plan display organized by days/meals
- Shopping list generation from meal plans
- Meal library management (browse, create, edit recipes)
- Session persistence and health monitoring
- Drag-and-drop meal management capabilities

## Tech Stack

- **React 18** with TypeScript 4.9+
- **Create React App** (react-scripts 5.0+) - Not Vite
- **Material-UI (MUI) v6** with custom earthy "crunchy mom aesthetic" theme
- **Connect-RPC** for gRPC communication with backend services
- **React Testing Library & Jest** for testing with fetch mocks
- **Date-fns v4** for date handling
- **@dnd-kit** for modern drag-and-drop functionality (replacing react-beautiful-dnd)
- **Emotion** for CSS-in-JS styling alongside MUI

## Development

### Prerequisites
- Node.js 22+ (uses Alpine in Docker)
- Yarn (workspace-enabled project)
- Backend services running on localhost:8090

### Commands
```bash
# Start dev server (proxies to localhost:8090/api)
yarn start

# Run tests
yarn test                # Single run
yarn test:watch         # Watch mode
yarn coverage           # With coverage report

# Build for production
yarn build

# Docker development
docker build -f Dockerfile.dev -t meal-planner-ui-dev .
docker run -p 3000:3000 meal-planner-ui-dev
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── MealManagementTab.tsx  # Recipe library management
│   ├── MealPlanDisplay.tsx    # Weekly meal plan grid
│   ├── Toast.tsx             # Notification system
│   ├── TypingIndicator.tsx   # Chat UI feedback
│   └── ...
├── api/                # Backend communication layer
│   ├── agentApi.ts     # AI agent workflow APIs
│   └── mealsApi.ts     # Meal management APIs
├── hooks/              # Custom React hooks
│   └── useSession.ts   # Session management
├── utils/              # Utility functions
│   └── mealPlanConverter.ts
├── theme.tsx           # MUI theme configuration
├── types.ts            # TypeScript type definitions
└── test-utils.tsx      # Testing utilities
```

## Key Features & Components

### Core Components
- **AgentPage**: Main chat interface with AI meal planner agent
- **MealManagementTab**: Recipe library with full CRUD operations
- **MealPlanDisplay**: Interactive weekly meal plan visualization with effort indicators
- **Session Management**: Auto-resume conversations on page refresh
- **Health Monitoring**: Real-time backend service availability checks

### UI Features  
- Responsive design with custom MUI theme
- Drag-and-drop meal organization
- Real-time typing indicators in chat
- Toast notifications for user feedback
- Comprehensive test coverage (>80%)

## API Integration

### gRPC/Connect-RPC
- Generated TypeScript clients from protobuf definitions
- Connects to API Gateway at `http://localhost:8090/api`
- Workspace dependency: `@mealplanner/generated`
- Error handling with proper TypeScript types

### Key API Services
- **Agent API**: Workflow management, message handling, checkpoints
- **Meals API**: CRUD operations for recipes and meal plans
- **Health API**: Service availability monitoring

## Configuration

### Environment
- **Proxy**: Configured in package.json to `http://localhost:8090`
- **Host**: Set to `0.0.0.0` in Docker for external access
- **Base URL**: `http://localhost:8090/api` for all API calls

### TypeScript Configuration
- Extends root workspace tsconfig
- Base URL set to `./src` for clean imports
- Includes shared workspace dependencies
- Strict type checking enabled

## Testing

### Framework & Tools
- **Jest** with React Testing Library
- **jest-fetch-mock** for API mocking
- **@testing-library/user-event** for interaction testing
- Coverage reports in `/coverage` directory

### Test Structure
- Component tests alongside source files (`*.test.tsx`)
- Shared test utilities in `test-utils.tsx`
- Mock setup in `setupTests.js`

### Running Tests
```bash
yarn test              # Run all tests once
yarn test:watch        # Run in watch mode
yarn coverage          # Generate coverage report
```

## Styling & Theming

### MUI Theme ("Crunchy Mom Aesthetic")
- **Colors**: Sage greens, warm creams, natural earth tones
- **Typography**: System fonts with custom variants
- **Components**: Extensive MUI component overrides
- **Responsive**: Uses MUI's responsive font sizing

### Key Theme Features
- Custom color palette with sage, natural, and earth tones
- Gradient backgrounds and subtle shadows
- Custom typography variants (cardTitle, recipeHeading, etc.)
- Consistent 12px border radius
- Hover animations and transitions

## Development Guidelines

### TypeScript Standards
- **Never use `any` type** - maintain strict typing
- Prefer interfaces over types for object shapes
- Use proper error handling with typed responses

### Component Patterns  
- **Functional components with hooks only**
- Follow existing MUI theme patterns in `src/theme.tsx`
- All components should have corresponding test files
- Use proper prop typing with interfaces

### Code Organization
- Group related functionality in folders
- Export barrel pattern from `api/index.ts`
- Shared types in workspace dependencies
- Clean import paths using baseUrl configuration

## Build & Deployment

### Production Build
```bash
yarn build
```
- Creates optimized bundle in `/build` directory
- Includes source maps and asset optimization
- Ready for static hosting or container deployment

### Docker Support
- Development Dockerfile included (`Dockerfile.dev`)
- Multi-stage build for workspace dependencies
- Configurable for different environments