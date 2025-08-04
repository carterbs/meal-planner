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

We are approaching perfection.

# Meal Planner Architecture Improvement Plan

## Overview
This plan addresses the architectural complexity that makes agent development challenging, with two parallel approaches: code improvements and agent education.

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

1. **✅ Week 1 Priority - COMPLETED**:
   - ✅ Fix swagger annotations for missing fields (especially timestamps)
   - ✅ Get lastPlanned working end-to-end without type assertions
   - ✅ Create proto → swagger validation test

2. **Current Priority (Week 2+)**:
   - Configure TypeScript generation correctly
   - Migrate UI to use only generated types
   - Add all validation to CI

### Success Criteria
- [ ] `yarn generate_code` produces types that need zero type assertions
- [ ] Adding a new proto field automatically appears in UI types
- ✅ CI fails if any proto field is missing from generated code
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

**✅ Immediate (This Week) - COMPLETED**:
1. ✅ Fix OpenAPI generation to include all fields
2. ✅ Add validation scripts that prevent type drift
3. ✅ Technical enforcement now prevents swagger/protobuf mismatches

**Current Priority**:
1. Configure TypeScript generation correctly (Section 2.2)
2. Migrate UI to use only generated types (Section 2.3)
3. Complete generation pipeline hardening (Section 2.4)

**Short Term (Next 2 Weeks)**:
1. Build type bridge layer
2. Unify code generation pipeline
3. Add remaining type safety checks

**Long Term (Month)**:
1. Simplify agent state management
2. Complete testing infrastructure

## Success Metrics
- Agent can add a field like 'lastPlanned' in under 30 minutes
- No type assertions needed in UI code
- All generated types match runtime data
- Single command regenerates all code correctly