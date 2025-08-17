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

**Goal**: All types defined only in protobuf

## Phase 2.3
**Step 1: Identify Hand-Written Types**
- [x] Audit ui/src/types.ts for non-UI types
- [ ] Audit agent-service/shared/types.ts for non-agent-service types
- [ ] Audit mcp-service for types that aren't generated (and should be)
- [ ] List all types that should come from generation
- [ ] Find all usages of these types in UI, agent, or mcp code

**Step 2: Migrate to Generated Types**
- [x] Update imports to use generated types
- [ ] Remove type assertions one by one
- [x] Delete redundant type definitions
- [x] Keep only UI-specific types (forms, local state)

**Step 3: Enforce Type Discipline**
- [x] Add ESLint rule banning type assertions for API types
- [x] Create import rule: API types must come from generated/
- [x] Add pre-commit hook to check

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

### Success Criteria
- [ ] `yarn generate_code` produces types that need zero type assertions
- [ ] Adding a new proto field automatically appears in UI types
- [ ] No manual type definitions for API responses


## Phase 3: Protocol Consolidation (1-2 weeks)

### 3.2 Simplify State Management
- Create typed state helpers for agent workflows
- Create typed state helpers for checkpoints
- Remove complex proto serialization in checkpoints

## Phase 4: Developer Tooling

### 4.1 Type Safety Enforcement
- Pre-commit hooks that validate type consistency
- Runtime type validation in development mode
- Type mismatch detection and reporting

## Success Metrics
- Agent can add a field like 'lastPlanned' in under 30 minutes
- No type assertions needed in UI code
- All generated types match runtime data
- Single command regenerates all code correctly