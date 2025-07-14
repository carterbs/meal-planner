# TODO: Technical Debt and Future Work

## HIGH PRIORITY: Fix Backend/Frontend Date Contract

**Issue**: Inconsistent date handling between backend and frontend causing `message.lastPlanned.toISOString is not a function` errors.

**Root Cause**: 
- Backend returns `lastPlanned` as ISO strings via HTTP API: `"2025-06-16T12:29:28.502Z"`
- Frontend protobuf deserialization expects proper Date objects
- Current "solution" uses fragile coercion in multiple places

**Proper Fix**:
1. **Backend**: Ensure `google.protobuf.Timestamp` fields are properly serialized in HTTP responses
2. **Proto Contract**: Verify that `optional google.protobuf.Timestamp last_planned = 4;` works correctly
3. **Frontend**: Remove all date coercion and expect properly typed data

**Current Workaround**: 
- Temporary `coerceDates()` calls in `meal-planning.ts` lines 564, 125, 290
- Search for "TODO: Remove this once backend/protobuf contract is fixed"

**Files to investigate**:
- Backend: `backend/models/mealplan.go` - meal serialization
- Generated: `typescript/*/node_modules/@mealplanner/generated/api.ts` - protobuf serialization
- Frontend: `typescript/agent/workflows/meal-planning.ts` - coercion workarounds

**Success criteria**: 
- Remove all `coerceDates()` calls
- Backend sends consistent date types
- Frontend receives properly typed Date objects
- No more `toISOString is not a function` errors

---

## COMPLETED: dayIndex Corruption Bug

**Issue**: ✅ FIXED - All meals had dayIndex=0 instead of proper values (0-6 for Mon-Sun)

**Root Cause**: ✅ IDENTIFIED - Checkpoint serialization was corrupting protobuf structure

**Fix**: ✅ IMPLEMENTED - Use `WeeklyMealPlan.toJSON()` in checkpoint saving instead of `as any` casting

**Verification**: ✅ CONFIRMED - Logs show correct dayIndex values: 0=Monday, 1=Tuesday, ..., 6=Sunday
