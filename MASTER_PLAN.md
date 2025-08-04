## Docker based "prod" env
For running on my linux box.

## Tasks
- Have AI normalize all of the ingredients one-time
- Also have AI normalize ingredients when inserting into the DB
- Have a repeatable script for this

## Adding recipes
- UI returns an error despite the backend completing properly
- "Process ingredients" Shouldn't be a necessary step. I should be able to just have a textarea full of ingredients and the processing should just happen.


## Agent mode for recipe management
Add, edit, etc
- Basically a free form text area and have the AI figure out all of the pieces of the receipe, then insert into the DB.
- Maybe a recipe workshopping feature or something.

## Refactors
- Extract handlers out of main.ts in the agent-service so we can unit test them properly.

### Service Layer Redundancy Analysis

After removing `IngredientService` (✅ completed), we have identified additional redundant service layers that are just pass-throughs to repositories:

#### ✅ Already Removed:
- **IngredientService**: Was pure pass-through with only logging. Now using `IngredientRepository` directly in gRPC handlers.

#### 🔴 Candidates for Removal (Pure Pass-throughs):

1. **RecipeStepService** - Complete pass-through to `RecipeStepRepository`
   - All 7 methods just add logging and call repository
   - No business logic, validation, or orchestration
   - Used in: `grpc_server.go` (6 methods)
   - **Recommendation**: Remove and use repository directly

2. **MealPlanService** - Mostly pass-through to `MealPlanRepository`
   - 6 out of 6 methods are simple pass-throughs with logging
   - No business logic or data transformation
   - Used in: `grpc_server.go` (3 methods)
   - **Recommendation**: Remove and use repository directly

3. **ShoppingListService** - Simple orchestration layer
   - `BuildShoppingList()`: Calls `MealRepo.GetMealsByIDs()` → `ShoppingListRepo.GenerateShoppingListFromMeals()`
   - Other methods are pass-throughs
   - **Some business logic present** (orchestrating meal fetching + list generation)
   - **Recommendation**: Keep but consider simplifying

#### 🟡 Keep (Has Business Logic):

4. **MealService** - Contains actual business logic
   - Orchestrates multiple repositories (`MealRepository` + `IngredientRepository`)
   - `UpdateMealIngredient()`: Updates ingredient → fetches updated meal
   - `DeleteMealIngredient()`: Deletes ingredient → fetches updated meal  
   - Has cross-cutting concerns and data aggregation
   - **Recommendation**: Keep - provides value

#### Removal Impact:
- **RecipeStepService**: 6 gRPC methods need to create `RecipeStepRepository` directly
- **MealPlanService**: 3 gRPC methods need to create `MealPlanRepository` directly
- **ServiceContainer**: Can be simplified to just `MealService` + `ShoppingListService`

#### Benefits:
- Reduces layers of indirection (models → repositories → services → gRPC)
- Eliminates ~200 lines of boilerplate code
- Faster development (no need to add service method for every repository method)
- Easier testing (test repositories directly, not service wrappers)

#### Next Steps:
1. Remove `RecipeStepService` (similar to `IngredientService` removal)
2. Remove `MealPlanService` 
3. Simplify `ServiceContainer`
4. Update gRPC handlers to use repositories directly

We are approaching perfection.

# Meal Planner Architecture Improvement Plan

## Overview
This plan addresses the architectural complexity that makes agent development challenging, with two parallel approaches: code improvements and agent education.

## Phase 1: Immediate Agent Education

### 1.1 Create Comprehensive Agent Guide (`AGENT-GUIDE.md`)
- **Data Flow Documentation**: Write about how data transforms through each layer
- **Type Mapping Guide**: Document exactly how proto types map to generated types and where type assertions are needed
- **Troubleshooting Guide**: Common errors and their solutions

## Phase 2: Type System Simplification - Implementation Plan

### 2.1 Fix Swagger Generation (Week 1)

**Goal**: Ensure swagger.json contains 100% of protobuf fields with correct types

**Step 1: Audit Current Swagger Annotations**
- [ ] Run type-validator sub-agent to identify all missing fields
- [ ] Document each field that exists in proto but not in swagger.json
- [ ] Identify patterns (e.g., all Timestamp fields are missing)

**Step 2: Fix Go Swagger Annotations**
- [ ] Add explicit swagger comments to api-gateway handlers for proto fields
- [ ] Create custom swagger type definitions for protobuf.Timestamp:
  ```go
  // @Success 200 {object} MainMealResponse
  // @Param lastPlanned type string format "date-time"
  ```
- [ ] Ensure nested proto messages are properly annotated
- [ ] Handle proto enums with proper swagger enum tags

**Step 3: Create Swagger Generation Test**
- [ ] Write Go test that:
  - Parses proto files to get all field names
  - Parses generated swagger.json
  - Fails if any proto field is missing from swagger
- [ ] Add to CI pipeline

### 2.2 Fix TypeScript Generation (Week 1-2)

**Goal**: Generated TypeScript types exactly match runtime JSON

**Step 1: Configure OpenAPI Generator**
- [ ] Create custom openapi-ts config to handle timestamps:
  ```javascript
  // openapi-ts.config.js
  export default {
    input: 'api-gateway/docs/swagger.json',
    output: 'generated/ts/gateway',
    types: {
      dates: 'strings', // Don't use Date objects
    }
  }
  ```
- [ ] Ensure optional fields generate as `field?: Type` not `field: Type | undefined`
- [ ] Configure proper enum generation

**Step 2: Fix Proto-to-TS Generation**
- [ ] Ensure protoc-gen-es preserves all fields
- [ ] Align timestamp handling between proto and OpenAPI
- [ ] Create mapping rules for proto types → TS types

**Step 3: Runtime Validation**
- [ ] Add development-mode type checker that validates API responses
- [ ] Throw errors when response doesn't match generated types

### 2.3 Single Source of Truth Migration (Week 2)

**Goal**: All types defined only in protobuf

**Step 1: Identify Hand-Written Types**
- [ ] Audit ui/src/types.ts for non-UI types
- [ ] Audit agent-service/shared/types.ts for non-agent-service types
- [ ] Audit mcp-service for types that aren't generated (and should be)
- [ ] List all types that should come from generation
- [ ] Find all usages of these types in UI, agent, or mcp code

**Step 2: Migrate to Generated Types**
- [ ] Update imports to use generated types
- [ ] Remove type assertions one by one
- [ ] Delete redundant type definitions
- [ ] Keep only UI-specific types (forms, local state)

**Step 3: Enforce Type Discipline**
- [ ] Add ESLint rule banning type assertions for API types
- [ ] Create import rule: API types must come from generated/
- [ ] Add pre-commit hook to check

### 2.4 Generation Pipeline Hardening (Week 2)

**Goal**: Make it impossible for types to drift

**Step 1: Create Validation Script**
```bash
#!/bin/bash
# scripts/validate-types.sh
# 1. Check proto → swagger field parity
# 2. Check swagger → TypeScript field parity  
# 3. Check for type assertions in UI
# 4. Ensure all generation is up to date
```

**Step 2: Add to Build Process**
- [ ] Run validation before every build
- [ ] Fail CI if validation fails
- [ ] Add detailed error messages

**Step 3: Create Type Test Suite**
- [ ] Integration tests that verify full data flow
- [ ] Test each endpoint with real data
- [ ] Verify no fields are lost in translation

### Implementation Order

1. **Week 1 Priority**:
   - Fix swagger annotations for missing fields (especially timestamps)
   - Get lastPlanned working end-to-end without type assertions
   - Create proto → swagger validation test

2. **Week 2 Priority**:
   - Configure TypeScript generation correctly
   - Migrate UI to use only generated types
   - Add all validation to CI

### Success Criteria
- [ ] `yarn generate_code` produces types that need zero type assertions
- [ ] Adding a new proto field automatically appears in UI types
- [ ] CI fails if any proto field is missing from generated code
- [ ] No manual type definitions for API responses


## Phase 3: Protocol Consolidation (1-2 weeks)

### 3.1 Standardize on Connect-ES
- Replace REST API Gateway with Connect-ES gateway
- Use protobuf as single source of truth
- Eliminate OpenAPI generation step entirely

### 3.2 Simplify State Management
- Create typed state helpers for agent workflows
- Remove complex proto serialization in checkpoints
- Use simple JSON for agent state persistence

## Phase 4: Developer Tooling (3-5 days)

### 4.1 Type Safety Enforcement
- Pre-commit hooks that validate type consistency
- CI checks that fail if generated code is outdated
- Runtime type validation in development mode

### 4.2 Debugging Improvements
- Consolidated logging with request tracing
- Type mismatch detection and reporting
- Generated code source maps for better stack traces

### 4.3 Testing Infrastructure
- Integration tests for full data flow
- Type consistency tests
- Agent-specific test scenarios

## Implementation Priority

**Immediate (This Week)**:
1. Create AGENT-GUIDE.md with data flow documentation
2. Add validation scripts for agents
3. Fix OpenAPI generation to include all fields

**Short Term (Next 2 Weeks)**:
1. Build type bridge layer
2. Unify code generation pipeline
3. Add type safety checks

**Long Term (Month)**:
1. Simplify agent state management
2. Complete testing infrastructure

## Success Metrics
- Agent can add a field like 'lastPlanned' in under 30 minutes
- No type assertions needed in UI code
- All generated types match runtime data
- Single command regenerates all code correctly