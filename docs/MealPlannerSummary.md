# Meal Planner Application Summary

## Overview

The Meal Planner is a full-stack application designed to help users plan their weekly meals, generate shopping lists, and manage recipes. The application follows a client-server architecture with a Go backend and a React TypeScript frontend with Material UI.

## Technology Stack

### Backend
- **Language**: Go (version 1.20)
- **Database**: PostgreSQL
- **Primary Libraries**:
  - `github.com/go-chi/chi/v5` - HTTP routing
  - `github.com/lib/pq` - PostgreSQL driver
  - `github.com/joho/godotenv` - Environment variable management
  - `github.com/DATA-DOG/go-sqlmock` - For database mocking in tests
  - `github.com/gorilla/mux` - URL routing and dispatching

### Frontend
- **Language**: TypeScript
- **Framework**: React 18
- **UI Library**: Material UI 6 (MUI)
- **Primary Libraries**:
  - `@mui/material` - Core UI components
  - `@mui/icons-material` - Icon components
  - `@mui/x-data-grid` - Data grid for tabular data
  - `@dnd-kit` - Drag and drop functionality
  - `date-fns` - Date formatting utilities
  - `react-beautiful-dnd` - Drag and drop for lists

### Infrastructure
- **Docker** - Containerization for development and deployment
- **Docker Compose** - Multi-container management
- **Makefile** - Build automation

### Testing
- Go's native testing package with high test coverage
- React Testing Library with Jest for frontend tests

## Architecture

### Backend
The application follows a layered architecture:

1. **API Layer** (handlers) - HTTP request handling, input validation, and response formatting
2. **Business Logic Layer** (models) - Core application logic and data processing
3. **Data Access Layer** (db) - Database connection management and query execution

### Frontend
The frontend follows a component-based architecture:

1. **App Component** - Main application container with routing and global state
2. **Feature Components** - Specific functionality components (MealPlanTab, MealManagementTab)
3. **UI Components** - Reusable interface elements (StepsEditor, Toast)
4. **Form Components** - Data entry interfaces (AddRecipeForm)

## Database Schema

The database consists of several core tables:

1. **meals** - Stores meal information:
   - `id` - Primary key
   - `meal_name` - Name of the meal
   - `relative_effort` - Cooking effort rating (0-10)
   - `last_planned` - When this meal was last included in a meal plan
   - `red_meat` - Boolean indicating if meal contains red meat
   - `url` - Optional link to external recipe

2. **ingredients** - Stores ingredients for each meal:
   - `id` - Primary key
   - `meal_id` - Foreign key referencing meals
   - `name` - Ingredient name
   - `quantity` - Numeric amount
   - `unit` - Unit of measurement (e.g., "cup", "oz")

3. **recipe_steps** - Stores preparation steps for each meal:
   - `id` - Primary key
   - `meal_id` - Foreign key referencing meals
   - `step_number` - Ordering of steps
   - `instruction` - Step description
   - `created_at` - Timestamp

## Frontend Components

### Main Application Structure

The frontend application is structured around a tabbed interface with two main sections:

1. **Meal Plan Tab** - For viewing and managing the weekly meal plan
2. **Meal Management Tab** - For browsing, creating, and editing recipes

The application uses a custom Material UI theme with a warm, culinary-focused color palette:
- Primary Color: Sage green (#5E8B3F)
- Secondary Color: Terracotta (#E9773E)
- Background: Soft cream (#F8F6F2)
- Custom Typography: Playfair Display for headings, Montserrat for body text

### Key Components

1. **MealPlanTab** - Displays the weekly meal plan with:
   - Days of the week
   - Assigned meals with effort levels
   - Meal swapping functionality
   - Shopping list generation
   - Copy to clipboard features
   - Plan finalization

2. **MealManagementTab** - Provides recipe management with:
   - Tabular view of all recipes
   - Detail view for individual recipes
   - Ingredient management
   - Recipe steps management
   - Delete functionality

3. **StepsEditor** - Specialized component for:
   - Adding, editing, and deleting recipe steps
   - Reordering steps with drag and drop
   - Bulk text import for steps

4. **AddRecipeForm** - Complex form for creating new recipes:
   - Basic recipe details (name, effort level, red meat status)
   - Bulk ingredient parsing from text
   - Step management
   - Fraction conversion for ingredients
   - Quantity doubling feature

5. **DatabaseConnectionError** - Error handling component for:
   - Detecting database connection issues
   - Providing user-friendly error messages
   - Offering reconnection functionality

### State Management

The application uses React's useState and useEffect hooks for state management with:
- Local component state for UI elements
- Lifted state for shared data between components
- Toast notifications for user feedback
- Loading states for asynchronous operations

### API Integration

The frontend communicates with the backend through a RESTful API with these key endpoints:
- `/api/mealplan` - For meal plan operations
- `/api/meals` - For recipe management
- `/api/meals/{mealId}/steps` - For recipe step operations
- `/api/shoppinglist` - For shopping list generation
- `/api/mealplan/ics` - Export the meal plan as an iCalendar file

## Core Features

### 1. Meal Planning

The application generates a weekly meal plan based on several criteria:
- Different effort levels for different days of the week:
  - Monday: Low effort (0-2)
  - Tuesday-Thursday: Low-medium effort (3-5)
  - Friday: Always "Eating out"
  - Saturday: Medium effort (3-5)
  - Sunday: High effort (6+)
- Avoids repeating meals used in the last 3 weeks
- Limits red meat consumption to at most once per week
- Allows users to swap individual meals if they don't like the suggestion

API Endpoints:
- `GET /api/mealplan` - Retrieves the current meal plan (or generates a new one)
- `POST /api/mealplan/generate` - Generates a new meal plan
- `POST /api/mealplan/finalize` - Finalizes a meal plan
- `POST /api/mealplan/swap` - Swaps one meal for another
- `POST /api/mealplan/replace` - Replaces a meal in the plan

### 2. Shopping List Generation

The application can generate a shopping list based on the selected meal plan.

API Endpoints:
- `POST /api/shoppinglist` - Generates a shopping list from a meal plan

### 3. Recipe Management

Users can view, create, update, and delete meals (recipes) in the system.

API Endpoints:
- `GET /api/meals` - Lists all meals in the database
- `POST /api/meals` - Creates a new meal
- `DELETE /api/meals/{mealId}` - Deletes a meal
- `PUT /api/meals/{mealId}/ingredients/{ingredientId}` - Updates an ingredient
- `DELETE /api/meals/{mealId}/ingredients/{ingredientId}` - Deletes an ingredient

### 4. Recipe Steps Management

The application allows detailed management of recipe preparation steps.

API Endpoints:
- `GET /api/meals/{mealId}/steps` - Gets all steps for a meal
- `POST /api/meals/{mealId}/steps` - Adds a step to a meal
- `POST /api/meals/{mealId}/steps/bulk` - Adds multiple steps at once
- `PUT /api/meals/{mealId}/steps/{stepId}` - Updates a step
- `DELETE /api/meals/{mealId}/steps/{stepId}` - Deletes a step
- `PUT /api/meals/{mealId}/steps/reorder` - Reorders steps
- `DELETE /api/meals/{mealId}/steps` - Deletes all steps for a meal

## User Experience Features

1. **Intelligent Form Processing**
   - Automatic conversion of common fraction characters to decimal values
   - Bulk ingredient parsing from text
   - Step reordering via drag and drop

2. **Copy to Clipboard**
   - One-click copying of meal plans for sharing
   - One-click copying of shopping lists
   - Exporting the meal plan as an `.ics` calendar file

3. **Visual Feedback**
   - Toast notifications for operation success/failure
   - Loading indicators for asynchronous operations

4. **Error Handling**
   - Specialized error handling for database connection issues
   - Reconnection functionality
   - User-friendly error messages

5. **Responsive Design**
   - Mobile-friendly layout
   - Adaptive UI elements

## Error Handling

The application includes robust error handling, especially for database connectivity:
- Custom error messages for database connection issues
- Middleware that provides user-friendly error messages
- Health check endpoint (`/api/health`) to verify database connectivity
- Reconnection endpoint (`/api/reconnect`) to attempt to re-establish database connection

## User Stories

1. **Weekly Meal Planning**
   - As a user, I want the application to generate a weekly meal plan based on my preferences
   - As a user, I want different effort levels for different days of the week
   - As a user, I want to avoid repeating meals from recent weeks
   - As a user, I want to limit red meat consumption

2. **Customizing Meal Plans**
   - As a user, I want to swap individual meals if I don't like the suggestion
   - As a user, I want to save my meal plan for the week

3. **Shopping List Generation**
   - As a user, I want to generate a shopping list based on my meal plan
   - As a user, I want to see all ingredients needed for the week

4. **Recipe Management**
   - As a user, I want to view all available recipes
   - As a user, I want to add new recipes to the system
   - As a user, I want to update ingredients in existing recipes
   - As a user, I want to delete recipes I no longer use

5. **Recipe Steps Management**
   - As a user, I want to add detailed preparation steps to my recipes
   - As a user, I want to update and reorder steps as needed
   - As a user, I want to see clear instructions when cooking

6. **User Interface**
   - As a user, I want a clean, intuitive interface that's easy to navigate
   - As a user, I want visual feedback when operations succeed or fail
   - As a user, I want to easily copy my meal plan or shopping list to share with others

## Development Setup

The application uses Docker for local development:
- PostgreSQL is deployed via Docker Compose
- Environment variables are loaded from a `.env` file
- Database migrations are automatically applied when the application starts
- Test data can be seeded using the `--seed` flag
- Frontend development server proxies API requests to the backend

## Next Steps and Potential Improvements

Based on the codebase review, potential improvements could include:

1. **Shopping List Optimization**
   - Grouping similar ingredients
   - Converting units for better aggregation
   - Highlighting pantry staples

2. **Enhanced Meal Planning Algorithms**
   - Consider dietary restrictions
   - Balance nutritional content
   - Support for themed meal days

3. **User Authentication**
   - Personal recipe collections
   - Sharing functionality

4. **Media Support**
   - Recipe images
   - Step-by-step photos

5. **Mobile Optimization**
   - Responsive design for mobile use
   - Potential mobile app version 

6. **Advanced Frontend Features**
   - Meal plan calendar view
   - Nutrition information
   - Recipe rating system
   - Favorite recipes
   - Search and filtering options

7. **Performance Optimizations**
   - Code splitting for faster load times
   - Caching frequently accessed data
   - Optimistic UI updates 