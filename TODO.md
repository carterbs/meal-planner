# TODO Items for Meal Planner

## High Priority

### API Endpoint Consolidation
**Priority: High**
**Status: Needs Investigation**

We currently have two similar but different endpoints that serve overlapping purposes:

1. **`/api/checkpoints/{threadId}`** (in `backend/handlers/checkpoints.go`)
   - Returns raw checkpoint data with full LangGraph state
   - Includes `current_step`, `channel_values`, metadata
   - Used by TypeScript agent's `HttpCheckpointSaver.getTuple()`
   - Primary purpose: LangGraph workflow state persistence

2. **`/api/workflows/{threadId}`** (in `backend/handlers/workflows.go`)
   - Returns meal planning specific workflow state
   - Includes meal plan, entries, messages, shopping list
   - Now also includes `current_step` (added as hotfix)
   - Used by TypeScript agent's `HttpCheckpointSaver.getWorkflowStatus()`
   - Primary purpose: UI/application state display

### Issues:
- **Data Duplication**: Both endpoints access checkpoint data but serve different views
- **Inconsistent Data**: The TypeScript agent was getting empty `current_step` from workflow endpoint
- **Maintenance Overhead**: Changes to workflow state structure require updates in multiple places
- **Performance**: Multiple database queries for similar data

### Proposed Solution:
1. **Consolidate into single endpoint** with query parameters to specify data format:
   - `/api/workflows/{threadId}?format=checkpoint` - returns raw checkpoint data
   - `/api/workflows/{threadId}?format=state` - returns formatted workflow state
   - `/api/workflows/{threadId}` - returns combined view (default)

2. **Alternative: Keep separate but refactor**:
   - Move common logic to shared service layer
   - Ensure data consistency between endpoints
   - Add comprehensive tests

### Impact Assessment Needed:
- [ ] Audit all callers of both endpoints
- [ ] Identify frontend dependencies
- [ ] Plan migration strategy for TypeScript agent
- [ ] Consider backward compatibility requirements

---

## Medium Priority

### Persist Messages in Every Checkpoint
**Status: Planned**
- Remove the special `latest` namespace that only stores chat messages.
- Add `repeated ChatMessage messages` to `AgentCheckpoint` proto.
- Regenerate code (`yarn proto:gen`, `go generate`).
- Update TypeScript & Go code to append chat messages directly into each checkpoint before calling `/api/checkpoints`.
- Write migration script to merge legacy `latest` rows into most recent real checkpoint per thread and delete them.
- Delete `UpdateWorkflowCheckpoint*` helpers once migration is done.

---

## Medium Priority

### Database Schema Review
**Status: Future Enhancement**
- Review if checkpoint storage can be optimized
- Consider separating LangGraph state from application state
- Evaluate if we need separate tables for different data types

### Error Handling Standardization
**Status: Improvement**
- Standardize error response formats across checkpoint and workflow endpoints
- Add proper HTTP status codes for different error scenarios
- Implement consistent logging patterns

---

## Notes
- The current hotfix in `GetWorkflowState` adds `current_step` extraction but is a temporary solution
- This creates technical debt that should be addressed in the next sprint
- Consider this when planning the next major API refactor
- After initial checkpoint sanitization fix, purge or resave any legacy checkpoints containing the deprecated `workflow_type` or `channel_values` fields (Step 2).