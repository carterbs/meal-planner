# The Workflow Debacle - Current State & Next Steps

## Original Problem (SOLVED ✅)
The e2e test `scripts/e2e_remove_friday.sh` was failing because:
1. **Missing `dayIndex` field**: The MCP server was receiving meal plan data without `dayIndex` values
2. **500 errors on meal plan save**: The `/api/mealplan` endpoint was returning 500 errors

## Root Cause Analysis & Fixes

### Problem 1: Missing `dayIndex` Field ✅ FIXED
**Issue**: Backend was using `protojson.MarshalOptions{UseProtoNames: false}` which serializes protobuf fields as snake_case (`day_index`), but TypeScript generated code expects camelCase (`dayIndex`).

**Solution**: 
- Reverted all marshal operations back to `UseProtoNames: false` (snake_case output)
- Fixed frontend workflow to use proper protobuf types when creating requests
- Updated `SaveMealPlanRequest` creation to use `MealPlanEntry.create()` with correct field mapping

### Problem 2: 500 Errors on Meal Plan Save ✅ PARTIALLY FIXED
**Issue**: The `SaveMealPlanHandler` was receiving JSON with camelCase field names but `protojson.Unmarshal` expects snake_case proto field names.

**Current Status**: 
- Fixed the workflow to properly create protobuf-compliant JSON requests
- Backend now expects snake_case field names consistently
- Still seeing 500 errors in latest test run - need to investigate further

### Problem 3: Workflow State Management 🔄 IN PROGRESS
**Issue**: The workflow reports "not currently awaiting feedback" even when `current_step: "await_feedback"` is set.

**Investigation**: 
- Added debug logging to see what state is actually being saved/retrieved
- Confirmed checkpoint saving/loading uses consistent config structure
- Need to run test with debug logs to see actual state values

## Current State & Next Steps

### Immediate Issues to Resolve:

1. **SaveMealPlan 500 Errors** 🚨 HIGH PRIORITY
   - The workflow is still getting 500 errors when saving meal plans
   - Need to check if the protobuf request structure is correct
   - Verify that `day_index` and `meal_type` fields are present in request

2. **Missing Debug Output** 🔍 
   - Our debug logs aren't appearing in test output
   - Need to confirm TypeScript compilation is working
   - May need to check console output redirection

3. **Feedback Loop Testing** 🧪
   - Once save errors are fixed, test the complete feedback workflow
   - Verify checkpoint state persistence
   - Confirm `isAwaitingFeedback` works correctly

### Next Actions:

1. **Run test with full debug output** to see:
   - What the `planJson.days` structure actually contains
   - Whether our protobuf request mapping is working
   - What state is being saved to checkpoints

2. **Fix remaining 500 errors** by:
   - Checking request body structure in SaveMealPlanHandler
   - Ensuring all required fields are present
   - Verifying protobuf unmarshaling works correctly

3. **Complete feedback loop testing** once save works:
   - Test that checkpoints preserve `await_feedback` state
   - Verify feedback processing works end-to-end
   - Confirm meal removal functionality

## Key Technical Insights

1. **Protobuf Field Naming**: The backend consistently uses snake_case field names (`day_index`, `meal_type`) while frontend objects use camelCase. The solution is to use protobuf `toJSON()` methods for consistent serialization.

2. **State Management**: The workflow saves state to checkpoints using protobuf Any types, and the feedback handler retrieves it using the same config structure. The consistency here looks correct.

3. **Request Structure**: The `SaveMealPlanRequest` needs properly formatted entries with `day_index`, `meal_type`, and `meal` fields to avoid 500 errors.

## Status Summary
- ✅ **dayIndex field issue**: RESOLVED 
- 🔄 **500 errors**: IN PROGRESS - need to verify request structure
- 🔄 **Feedback workflow**: PENDING - waiting on save fix
- 🎯 **Next milestone**: Complete end-to-end meal removal test