---
description: Front-end auto-resume & new-session flow
---
# Session Auto-Resume & New-Session Flow

This document details the implementation plan for automatically resuming an incomplete workflow when the frontend loads and gracefully starting a new session. It includes file paths, data schemas, UI tweaks, and API requirements.

## 1. Definitions

| Term | Meaning |
|------|---------|
| **Session** | A single instance of a workflow identified by `threadId` (a.k.a. `sessionId` on the client). |
| **Incomplete Workflow** | Any workflow whose `current_step` enum value is **not** `COMPLETE`. |
| **Abandoned Workflow** | A workflow the user actively ends without reaching `COMPLETE`; its final status is `ABANDONED`. |

## 2. Data Contract

### 2.1 LocalStorage

```text
key: "sessionId"
value: string  // threadId returned by backend when a session is created
```

### 2.2 Backend JSON (simplified)

```ts
// GET /api/workflows/{threadId}
interface WorkflowState {
  threadId: string;
  workflow_type: WorkflowType;        // "meal_planning" | "recipe_management" | ...
  current_step: string;               // Enum per type
  /* additional fields per workflow schema */
}
```

```ts
// POST /api/workflows/{threadId}/abandon
Body: {}
Response 200 OK: { status: "ABANDONED" }
```

> NOTE: `ABANDONED` is **not** a step; it is a *terminal status* we set on the backend while leaving `current_step` unchanged.

## 3. Front-End Changes

### 3.1 New Hook: `frontend/src/hooks/useSession.ts`

* Encapsulates session detection, resumption, and abandonment logic.
* Exposes:
  * `isResuming: boolean` – true while fetching resume data.
  * `resumeData?: WorkflowState` – populated on successful resume.
  * `startNewSession(): Promise<void>` – wraps existing start-session flow and handles abandonment.

### 3.2 Modify `frontend/src/AgentPage.tsx`

* Import `useSession`.
* On mount, call the hook; if `resumeData` exists, hydrate UI components (existing props already expect fetched data).
* Replace current button:

```tsx
<Button
  size="small"                // previously default (large)
  variant="contained"
  onClick={startNewSession}
  data-testid="start-session"
>
  Start\u00a0New\u00a0Session
</Button>
```

### 3.3 Unit Tests

* `AgentPage.test.tsx` – add cases for:
  * LocalStorage with incomplete workflow \u2192 auto-resume hides button.
  * Completed workflow in storage \u2192 storage cleared, button visible.
  * `startNewSession()` sends abandon request when needed.

## 4. Backend Changes

* Add **POST** `/api/workflows/{threadId}/abandon` route (if missing).
  * Marks record `status = "ABANDONED"` (new column if necessary).
* Ensure `GET /api/workflows/{threadId}` returns `current_step` so client can determine completion.

## 5. File-by-File Worklist

| File | Action |
|------|--------|
| `frontend/src/hooks/useSession.ts` | **NEW** – hook implementation. |
| `frontend/src/AgentPage.tsx` | Import hook, consume `resumeData`, shrink button. |
| `frontend/src/AgentPage.test.tsx` | Add tests. |
| `backend/routes/workflows.go` (or equivalent) | Add abandon endpoint handler. |
| `backend/models/workflow.go` | Add `status` field/enum with `ABANDONED`. |
| Migrations | Create column `status VARCHAR DEFAULT 'ACTIVE'`. |

## 6. Implementation Steps

1. **Schema**: Update Go model and migration to include `status`.
2. **API**: Implement abandon handler to set `status = 'ABANDONED'`.
3. **Hook**: Create `useSession` with logic:
   ```ts
   useEffect(() => {
     const id = localStorage.getItem('sessionId');
     if (!id) return;
     fetch(`/api/workflows/${id}`)
       .then(r => r.json())
       .then(wf => {
         if (wf.current_step !== 'complete') {
           setResumeData(wf);
         } else {
           localStorage.removeItem('sessionId');
         }
       });
   }, []);
   ```
4. **AgentPage**: Use hook; if `resumeData`, bypass new-session flow.
5. **Button**: Change size to `small`.
6. **Testing**: Extend existing RTL tests.
7. **Docs**: Keep this file updated when implementation evolves.

## 7. Acceptance Criteria

- Landing on the site with `sessionId` of an incomplete workflow automatically resumes and hides the big button.
- Landing with no session or a completed one shows the small button.
- Starting a new session abandons any existing one.
- All new tests pass; existing tests remain green.
- CI, lint, and Go unit tests pass.
