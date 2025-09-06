# Task 6 — Tests & Docs (Post‑Styling Updates)

Goal: Update unit tests to reflect Tabs and chip‑based meal rows; remove emoji‑driven tests; document final palette choices.

Files to touch
- `ui/src/pages/AgentPage/components/plan/PlanPanel.test.tsx`
- `ui/src/pages/AgentPage/components/plan/MealPlanDisplay.test.tsx`
- `UI-Refresh-Plan.md` (if palette/components changed during implementation)

Steps
1) Update PlanPanel tests for Tabs
- Switch from `role='button'` to `role='tab'` queries:
  ```ts
  const planTab = screen.getByRole('tab', { name: 'Meal Plan' });
  const listTab = screen.getByRole('tab', { name: 'Shopping List' });
  ```
- Keep the disabled assertion for the Shopping List tab when `!hasShopping`.
- Click list tab and assert `onTabChange(1)` is called.

2) Remove getEffortIcon tests
- In `MealPlanDisplay.test.tsx`, delete the `describe('getEffortIcon', ...)` block and any emoji expectations.

3) Adjust remaining expectations
- If any tests expected emojis next to meal names, remove those checks.
- Keep highlight behavior assertions (data attribute) as‑is.

4) Run tests
- From repo root: `yarn test`.
- Resolve any snapshot/test updates caused by component swaps (favor semantic queries over snapshots).

5) Update docs
- Reflect final palette or component decisions in `UI-Refresh-Plan.md`.

Acceptance
- UI tests pass with Tabs and chip‑based rows.
- No tests reference emojis or the removed `getEffortIcon` helper.

