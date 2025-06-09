

---

# Automatic Shopping List Generation Plan

## Overview
Convert shopping list from manual generation (via button click) to automatic generation on page load and automatic updates when meals change.

## Current State
- Shopping list generated manually via "Get Shopping List" button
- Stored in `shoppingList` state in `MealPlanTab.tsx`
- API: `POST /api/shoppinglist` with `{plan: mealIDs[]}`

## Implementation Steps

### Step 1: Create Reusable Shopping List Function
- Extract `getShoppingList()` logic into `generateShoppingListAutomatic()`
- Add loading state management (`isLoadingShoppingList`)
- Add error handling state (`shoppingListError`)
- Make it debounced to prevent rapid successive calls

### Step 2: Auto-generate on Page Load
- Modify main `useEffect` to call shopping list generation after meal plan loads
- Only generate if meal plan contains meals

### Step 3: Auto-update on Meal Changes
- Hook into `swapMeal()` to regenerate after successful swap
- Hook into `toggleSkipMeal()` to regenerate after skip changes
- Hook into `generateNewPlan()` to trigger auto-generation

### Step 4: Update UI
- Remove manual "Get Shopping List" button
- Add loading indicator for shopping list section
- Add error display for shopping list failures
- Show empty state when no meals are planned

### Step 5: Add Debouncing
- Use `useCallback` and state dependencies to debounce rapid changes
- Prevent multiple API calls when user makes quick successive changes

## Files to Modify
- `frontend/src/components/MealPlanTab.tsx` (main implementation)
- `frontend/src/components/MealPlanTab.test.tsx` (update tests)

## Key Benefits
- Always up-to-date shopping list
- No manual intervention required
- Better user experience
- Simplified UI (fewer buttons)