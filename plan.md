# Meal Type Categorization Implementation Plan

## Overview
Add support for categorizing meals by type (breakfast, lunch, dinner) to enable future breakfast menu functionality. All existing meals will be categorized as "dinner" meals during the transition.

## Current State Analysis
- **Backend**: Meal struct in `backend/models/meal.go:12-21` has no meal type field
- **Frontend**: Meal interface in `frontend/src/types.ts:18-27` has no meal type field  
- **Database**: Current meals table schema doesn't include meal type

## Implementation Phases

### Phase 1: Database Schema Changes
1. **Add meal_type column** to meals table with default value 'dinner'
2. **Update existing meals** to have meal_type = 'dinner'
3. **Create migration** to handle this change safely

**Files to modify:**
- `backend/migrations/add_meal_type.sql` (new file)

### Phase 2: Backend Updates
1. **Update Meal struct** (`backend/models/meal.go:12`) to include MealType field
2. **Update MealColumns** (`backend/models/meal.go:24`) to include meal_type
3. **Update SQL queries** (`backend/models/meal.go:27-41`) to select meal_type
4. **Update processMealRows** function to handle meal_type scanning
5. **Update CreateMeal** function to support meal_type parameter

**Files to modify:**
- `backend/models/meal.go`

### Phase 3: API Handler Updates
1. **Update meal handlers** in `backend/handlers/meals.go` to support meal_type filtering
2. **Add endpoint** for getting meals by type (breakfast/lunch/dinner)
3. **Update meal creation** to accept meal_type parameter

**Files to modify:**
- `backend/handlers/meals.go`

### Phase 4: Frontend Updates
1. **Update Meal interface** (`frontend/src/types.ts:18`) to include mealType field
2. **Update components** to display and filter by meal type
3. **Update meal creation forms** to include meal type selection

**Files to modify:**
- `frontend/src/types.ts`
- `frontend/src/components/MealManagementTab.tsx`
- `frontend/src/AddRecipeForm.tsx`

### Phase 5: Testing & Validation
1. **Database migration testing**
2. **Backend API testing** with meal types
3. **Frontend component testing** with meal type support
4. **End-to-end testing** of meal type functionality

**Files to modify:**
- `backend/models/meal_test.go`
- `backend/handlers/meals_test.go`
- `frontend/src/components/MealManagementTab.test.tsx`
- `frontend/src/AddRecipeForm.test.tsx`

## Key Benefits
- All existing meals automatically categorized as "dinner"
- Foundation for breakfast/lunch support
- Backwards compatible migration
- Clean separation of meal types for future features

## Testing Strategy
- Run backend tests: `cd backend && go test ./...`
- Run frontend tests: `npm test -- --watchAll=false`
- Test migration rollback capability
- Verify API endpoints work with meal type filtering

## Commit Strategy
- Commit after each phase completion
- Include tests in same commit as implementation
- Use descriptive commit messages explaining the "why"