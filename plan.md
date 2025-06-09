---

# Move Ingredients to Meal Cards Plan

## Overview
Move ingredients from the separate shopping list section into individual meal cards with removal functionality and top-level copy button.

## Requirements
- Show ingredients under each meal's name/effort in the meal cards
- Keep existing pill-style aesthetic for ingredients
- Add X button to each ingredient for removal
- Remove the separate shopping list section entirely
- Keep "Copy Shopping List" button at top that aggregates all visible ingredients
- Removed ingredients should not appear in copy output

## Implementation Steps

### Step 1: Add State Management for Removed Ingredients
- Add `removedIngredients: Set<string>` state to track removed items
- Use format `"${mealId}-${ingredientId}"` as keys
- Keep existing shopping list generation for copy functionality

### Step 2: Modify Meal Card UI
- Add ingredients display under meal name and effort level
- Keep existing pill styling: `linear-gradient(135deg, #fefffe 0%, #fafcf8 100%)`
- Add small X button to each ingredient pill
- Use grid layout for ingredients similar to current shopping list

### Step 3: Remove Shopping List Section
- Delete entire shopping list section at bottom
- Remove associated loading states and error handling for that section
- Keep the auto-generation logic for copy functionality

### Step 4: Implement Copy Functionality
- Move "Copy Shopping List" button to top of meal plan
- Collect ingredients from all visible meal cards
- Filter out removed ingredients using `removedIngredients` state
- Aggregate duplicate ingredients with combined quantities
- Format for clipboard: `"${quantity} ${unit} ${name}"`

### Step 5: Add Remove Ingredient Functionality
- Add click handler for X buttons
- Update `removedIngredients` state when clicked
- Filter ingredients in meal card display
- Filter ingredients in copy function

## Files to Modify
- `frontend/src/components/MealPlanTab.tsx` (main implementation)
- `frontend/src/components/MealPlanTab.test.tsx` (update tests)

## UI Changes
- **Before**: Separate shopping list section at bottom with aggregated ingredients
- **After**: Ingredients in each meal card with individual removal, copy button at top

## Data Flow
1. Shopping list auto-generates as before
2. Ingredients display in meal cards, filtered by `removedIngredients`
3. Copy button aggregates visible ingredients and formats for clipboard
4. Remove buttons update `removedIngredients` state

