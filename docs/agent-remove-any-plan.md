# TypeScript Agent Strict-Typing Plan (Remove `any`)

## 1. Global Rules

**A. Compiler pressure**
- `tsconfig.json`: enable `"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`.
- Run `yarn tsc --noEmit` after each refactor.

**B. Source-of-truth for wire types**
- Any type sent *to* or *from* the backend **must** come from the generated `api.proto` messages.
- If a required message is missing, extend `api.proto`, run `yarn proto:gen`, and use the new type.
- No `any`, `unknown`, or ad-hoc interfaces for wire payloads.

**C. Internal vs Shared vs Wire**
- *File-local* only → define type at top of the file.
- *Shared* across TS files but **not** on the wire → place in `typescript/agent/types/`.
- *Wire* payloads → always proto-generated types.

**D. Generics & helpers**
- Use `Partial<T>`, `Record<K,V>`, etc. instead of `any`.
- Only use `unknown` when unavoidable, then narrow immediately.

---

## 2. Refactor Roadmap

### Step 0 – Regenerate proto stubs
```bash
yarn proto:gen
```
Ensures up-to-date wire types.

### Step 1 – `shared/httpCheckpointer.ts`
1. Add `ExtendedRunnableConfig` (shared/internal).
2. Replace `(config as any)` casts with proper typing.
3. Return types:
   - `getWorkflowStatus → Promise<WorkflowStatus | null>` (proto).
   - `listWorkflows → Promise<WorkflowSummary[]>` (proto).
4. Result: file compiles strict with **zero** `any`/`unknown`.

### Step 2 – `workflows/meal-planning.ts`
1. Class fields
   - `graph: MealPlanningGraph`
   - `llm` / `nanoLlm`: `ChatOpenAI`
2. Methods
   - `saveCheckpoint(config, state)` → strict types (`ExtendedRunnableConfig`, `MealPlanningState` proto).
   - Graph `invoke(input, config)` → `MealPlanningInput`, `ExtendedRunnableConfig`.
3. Remove misc casts (`as any`). Extend proto messages where needed.
4. Replace `any[]` JSON parsing with concrete arrays (`Meal[]`).
5. Fix dictionaries (`Record<string, Ingredient[]>`).
6. Compile & iterate until clean.

### Step 3 – Fill proto gaps
For each TODO, add/extend message in `api.proto`, run `yarn proto:gen`, update usages.

### Step 4 – Remaining `agent` sub-directories
Process each TS file:
- Remove `any` / `unknown`.
- Ensure types follow placement rules.
- Run `yarn tsc --noEmit` clean before moving on.

---

## 3. Acceptance Checklist
- [ ] `typescript/agent` compiles under strict mode with **zero** explicit or implicit `any` / `unknown`.
- [ ] All wire-exposed types map 1-to-1 to generated proto messages.
- [ ] Internal/shared types live in correct locations.
- [ ] All existing tests & manual smoke flows still pass.

---

*Last updated: 2025-07-14*
