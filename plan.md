# Plan: Replace Dummy Breakfast/Lunch Data with Real Database Meals

## Current State Analysis

### Backend Current State:
- **Meal Planning Logic** (`models/mealplan.go`): Only generates dinner meals for the weekly plan
- **Meal Plan API** (`handlers/mealplan.go`): Returns single meal per day (dinner only)
- **Database**: Now contains 16 breakfast + 14 lunch + 49 dinner meals = 79 total meals
- **Meal Types**: Backend fully supports `meal_type` field (`breakfast`, `lunch`, `dinner`)

### Frontend Current State:
- **MealPlanTab Component**: Uses dummy breakfast/lunch data with fake IDs (+1000 for breakfast, +2000 for lunch)
- **Extended Meal Plan Structure**: Already supports `{day: {Breakfast: meal, Lunch: meal, Dinner: meal}}`
- **Shopping List**: Correctly aggregates ingredients from all three meal types
- **Swapping**: Works for all meal types but breakfast/lunch use fake data

## Goal State
- Backend generates real breakfast and lunch meals from database
- Frontend displays real breakfast and lunch meals with ingredients
- All meal operations (swap, skip, finalize) work for all three meal types
- Shopping list includes ingredients from all real meals

---

## Implementation Plan

### Phase 1: Backend API Updates

#### 1.1 Update Meal Plan Generation (`backend/models/mealplan.go`)
**Current**: `GenerateWeeklyMealPlan()` returns `map[string]*Meal` (one meal per day)
**New**: Return `map[string]map[string]*Meal` (day -> mealType -> meal)

**Changes Needed**:
```go
// New structure
type WeeklyMealPlan struct {
    Monday    DayMealPlan `json:"Monday"`
    Tuesday   DayMealPlan `json:"Tuesday"`
    // ... etc
}

type DayMealPlan struct {
    Breakfast *Meal `json:"Breakfast"`
    Lunch     *Meal `json:"Lunch"`  
    Dinner    *Meal `json:"Dinner"`
}
```

**New Logic**:
- Generate breakfast meals: Low effort (1-2), no red meat restrictions
- Generate lunch meals: Low effort (1-2), no red meat restrictions  
- Generate dinner meals: Keep existing logic (effort varies by day, red meat restrictions)
- Respect last_planned dates across all meal types
- Add meal type filtering to `pickMeal()` function

#### 1.2 Update `pickMeal()` Function
**Add Parameter**: `mealType string` to filter by meal type
**Update Query**: Add `AND meal_type = $4` condition
**Update Calls**: Pass appropriate meal type ('breakfast', 'lunch', 'dinner')

#### 1.3 Update API Endpoints (`backend/handlers/mealplan.go`)

**`GetMealPlan()` & `GenerateMealPlan()`**:
- Change return type from `map[string]*Meal` to new extended structure
- Update ingredient fetching to handle multiple meals per day
- Maintain backward compatibility for now (optional)

**`GetLastPlannedMeals()`**:
- Update to retrieve last planned for each meal type separately
- Return structured format with breakfast/lunch/dinner per day

#### 1.4 Update Swap Functionality
**New Parameter**: `meal_type` in swap payload
**Update Logic**: Filter available meals by meal type when swapping
**API**: Add meal type to swap endpoints

---

### Phase 2: Frontend Updates

#### 2.1 Remove Dummy Data Logic (`frontend/src/components/MealPlanTab.tsx`)
**Current Lines 84-107**: Remove fake breakfast/lunch meal generation
**Replace With**: Direct consumption of new API format

**Before**:
```typescript
// Transform the old meal plan format to new extended format
const extendedMealPlan: ExtendedMealPlan = {};
WEEK_DAYS.forEach(day => {
    extendedMealPlan[day] = {
        Breakfast: /* fake data */,
        Lunch: /* fake data */,
        Dinner: mealPlanData[day] || null,
    };
});
```

**After**:
```typescript
// API now returns extended format directly
setMealPlan(mealPlanData);
```

#### 2.2 Update Swap Functionality
**Current**: Only works properly for dinner (real meals)
**Update**: Pass `mealType` parameter in swap requests for all meal types

**Before**:
```typescript
fetch("/api/meals/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meal_id: currentMeal.id }),
})
```

**After**:
```typescript
fetch("/api/meals/swap", {
    method: "POST", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
        meal_id: currentMeal.id,
        meal_type: mealType.toLowerCase()
    }),
})
```

#### 2.3 Update Finalize Logic
**Current**: Only finalizes dinner meals
**Update**: Finalize all meal types

**Before**:
```typescript
WEEK_DAYS.forEach(day => {
    if (mealPlan[day]?.Dinner) {
        oldFormat[day] = mealPlan[day].Dinner!;
    }
});
```

**After**: 
```typescript
const allMeals: Meal[] = [];
WEEK_DAYS.forEach(day => {
    MEAL_TYPES.forEach(mealType => {
        const meal = mealPlan[day][mealType];
        if (meal) allMeals.push(meal);
    });
});
```

---

### Phase 3: Data Structure Updates

#### 3.1 Update Backend Types
**Add**: New structured meal plan types
**Ensure**: Consistent JSON serialization tags
**Update**: All handlers to use new types

#### 3.2 Update Frontend Types
**Verify**: `ExtendedMealPlan` interface matches new API
**Add**: Type safety for meal type parameters
**Update**: All components using meal plan data

---

### Phase 4: Testing & Validation

#### 4.1 Backend Testing
- [ ] Verify meal plan generation includes all three meal types
- [ ] Test meal type filtering in `pickMeal()`
- [ ] Validate `last_planned` tracking across meal types
- [ ] Test swap functionality with meal type parameter
- [ ] Ensure red meat logic only applies to dinner

#### 4.2 Frontend Testing  
- [ ] Verify real meals display for breakfast and lunch
- [ ] Test swapping works for all meal types
- [ ] Validate shopping list includes all real ingredients
- [ ] Test finalize updates all meal types
- [ ] Verify no more fake IDs (+1000, +2000)

#### 4.3 Integration Testing
- [ ] Full meal plan generation and display
- [ ] Complete workflow: generate → swap → finalize
- [ ] Shopping list accuracy with real breakfast/lunch ingredients
- [ ] Calendar export includes all meal types

## Success Criteria
- ✅ Breakfast meals are real meals from database (not dummy data)
- ✅ Lunch meals are real meals from database (not dummy data)  
- ✅ All meal types can be swapped with appropriate meal type filtering
- ✅ Shopping list includes real ingredients from breakfast and lunch
- ✅ Finalize functionality updates last_planned for all meal types
- ✅ No fake IDs or dummy data in the system
- ✅ Calendar export includes all three meal types
- ✅ User experience is seamless and consistent across meal types

---

## Risk Mitigation
- **Database backup**: Already completed ✅
- **Fallback plan**: Keep dummy data logic as fallback during transition
- **Testing**: Comprehensive testing at each phase
