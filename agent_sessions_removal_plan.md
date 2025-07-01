# Comprehensive Implementation Plan: Remove agent_sessions Table

## Current Progress (as of 2025-07-01)
- Phase 4: Test Updates: Added workflow_checkpoints mock in `handlers/meals_test.go` (fixed `AddRow` usage), all meal handler tests pass except `TestRemoveMealHandler`.
- Test suite: only `TestRemoveMealHandler` failing with HTTP 500 due to missing mock for recipe steps in `RemoveMealHandler`.
- Legacy `models/session.go` file still present; lint errors exist and file pending removal.
- Migration files (`007_drop_agent_sessions.up.sql`, `.down.sql`) not yet created.
- `models/migrate.go` not yet updated to remove `agent_sessions` and `agent_messages` definitions and indexes.
- Handler updates for `backend/handlers/agent.go` and `backend/handlers/workflows.go` pending.

## Phase 1: Database Schema Removal

### 1.1 Create Drop Migration
**File:** `backend/migrations/007_drop_agent_sessions.up.sql`
```sql
-- Drop dependent table first (due to foreign key constraint)
DROP TABLE IF EXISTS agent_messages;
-- Drop the main table
DROP TABLE IF EXISTS agent_sessions;
```

**File:** `backend/migrations/007_drop_agent_sessions.down.sql`
```sql
-- Recreate tables if rollback needed (copy from migrate.go)
-- agent_sessions table recreation
-- agent_messages table recreation
```

### 1.2 Update Migration System
**File:** `backend/models/migrate.go`
- **Lines 23-33:** Remove agent_sessions table creation
- **Lines 35-44:** Remove agent_messages table creation 
- **Lines 47-55:** Remove agent_sessions indexes
- **Line 58:** Remove from tables array

## Phase 2: Backend Code Removal

### 2.1 Remove Model Definitions
**File:** `backend/models/session.go` - **DELETE ENTIRE FILE**
Contains:
- `AgentSession` struct
- `CreateAgentSession()` function
- `GetAgentSession()` function  
- `UpdateAgentSession()` function
- `AddMessage()` function
- `DeleteAgentSession()` function

### 2.2 Update API Handlers

**File:** `backend/handlers/agent.go`
- **Line 88:** Remove `models.CreateAgentSession()` call
- **Line 105:** Remove `models.UpdateAgentSession()` call
- **Line 209:** Remove `models.GetAgentSession()` call
- **Line 225:** Remove `models.UpdateAgentSession()` call
- Replace with workflow_checkpoints equivalent calls

**File:** `backend/handlers/workflows.go`
- **Line 33:** Remove `models.GetAgentSession()` call
- **Line 125:** Remove `models.GetAgentSession()` call
- **Line 137:** Remove `models.UpdateAgentSession()` call
- **Line 211:** Remove `models.GetAgentSession()` call
- **Line 231:** Remove `models.UpdateAgentSession()` call
- Replace with `models.GetWorkflowCheckpoint()` calls

**File:** `backend/handlers/meals.go`
- **Line 106:** Remove `models.GetAgentSession()` call
- **Line 157:** Remove `models.UpdateAgentSession()` call
- Replace with workflow_checkpoints operations

### 2.3 Remove Import References
Update all handler files to remove:
```go
// Remove any unused imports after function removal
```

## Phase 3: API Endpoint Refactoring

### 3.1 Modify Existing Endpoints
Replace agent_sessions data retrieval with workflow_checkpoints:

**Agent Endpoints:**
- `POST /api/agent/chat` - Use workflow checkpoints for state
- `GET /api/agent/session/{threadId}` - Get from workflow_checkpoints
- `PUT /api/agent/session/{threadId}` - Update workflow_checkpoints

**Workflow Endpoints:**
- `GET /api/workflows/{threadId}` - Use existing GetWorkflowCheckpoint
- `PUT /api/workflows/{threadId}` - Use existing UpdateWorkflowCheckpoint

### 3.2 Response Structure Changes
Update API responses to use workflow checkpoint data structure:
- Remove `AgentSession` JSON responses
- Return workflow checkpoint data directly
- Maintain thread_id, meal_plan, and status fields for compatibility

## Phase 4: Test Updates

### 4.1 Remove Test Dependencies
**File:** `backend/handlers/meals_test.go`
- **Lines 855-856:** Remove agent_sessions mock setup
- **Line 859:** Remove agent_sessions UPDATE expectation
- Replace with workflow_checkpoints mock expectations

### 4.2 Update Unit Tests
- Modify tests to use workflow_checkpoints functions
- Update mock expectations for new function calls
- Ensure test data reflects workflow checkpoint structure

## Phase 5: Documentation Updates

### 5.1 Update README Files
**File:** `backend/README.md`
- **Line 38:** Remove comment about agent_sessions removal
- Update API documentation to reflect workflow_checkpoints usage

### 5.2 Update API Documentation
- Remove agent_sessions references from API docs
- Update endpoint documentation for new data structures

## Phase 6: Implementation Order

### 6.1 Step-by-Step Execution
1. **Create database migration** (007_drop_agent_sessions)
2. **Update handler functions** to use workflow_checkpoints
3. **Remove session.go model file**
4. **Update migrate.go** to remove table definitions
5. **Run migration** to drop tables
6. **Update tests** to use new functions
7. **Update documentation**
8. **Test all API endpoints** to ensure functionality

### 6.2 Risk Mitigation
- **Test in development** before production deployment
- **Verify workflow_checkpoints** handle all use cases
- **Ensure frontend compatibility** with API changes
- **Monitor application logs** after deployment

## Phase 7: Verification Checklist

### 7.1 Code Verification
- [ ] No references to `agent_sessions` in codebase
- [ ] No references to `AgentSession` struct
- [ ] All handler functions use workflow_checkpoints
- [ ] All tests pass with new implementation
- [ ] Database migration runs successfully

### 7.2 Functional Verification  
- [ ] Agent chat functionality works
- [ ] Meal planning workflows persist correctly
- [ ] Shopping list generation functions
- [ ] Session state maintained across requests
- [ ] All API endpoints return expected data

## Summary

This plan completely removes the legacy `agent_sessions` table and replaces its functionality with the modern `workflow_checkpoints` system. The `workflow_checkpoints` table provides superior workflow state management with full serialization, resumable workflows, and LangGraph integration.

### Key Benefits of Migration:
- **Unified state management** through workflow_checkpoints
- **Improved workflow persistence** and resumability
- **Reduced code complexity** by eliminating duplicate session tracking
- **Better integration** with the TypeScript agent module
- **Modern architecture** aligned with LangGraph patterns

### Files Affected:
- `backend/models/migrate.go` - Remove table definitions
- `backend/models/session.go` - DELETE entirely
- `backend/handlers/agent.go` - Update function calls
- `backend/handlers/workflows.go` - Update function calls  
- `backend/handlers/meals.go` - Update function calls
- `backend/handlers/meals_test.go` - Update tests
- `backend/README.md` - Update documentation
- `backend/migrations/007_drop_agent_sessions.{up,down}.sql` - New migration files