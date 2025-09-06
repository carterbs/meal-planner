# Task 4 — Week Layout (Sticky Headers + Rhythm)

Goal: Improve scanability with sticky weekday headers and consistent vertical rhythm. No new features.

Files to touch
- `ui/src/pages/AgentPage/components/plan/MealPlanDisplay.tsx`

Steps
1) Make weekday headers sticky
- On the Box that renders each day label (above the card), add sticky positioning:
  ```tsx
  sx={{ position: 'sticky', top: 0, zIndex: 1,
        backgroundColor: 'background.default', py: 0.5 }}
  ```
- Ensure the top container has `overflow: 'auto'` (already present) so stickiness works.

2) Add faint dividers between days
- After each day section (except the last), insert:
  ```tsx
  <Divider sx={{ my: 1, opacity: 0.5 }} />
  ```

3) Enforce spacing rhythm
- Use gaps instead of ad‑hoc margins where possible.
- Between day sections: `gap: 1.5` (≈12px) or `my: 1.5`.
- Inside cards and meal rows: `gap: 1` (≈8px).

4) Validate scroll behavior
- Scroll the plan and confirm day headers remain visible and do not overlap content.

Acceptance
- Day labels stay visible while scrolling.
- Subtle dividers separate day groups.
- Spacing adheres to 8/16/24 multiples for a consistent rhythm.

Commands
- Visual check: `cd ui && yarn start`
- Full test run (from repo root): `yarn test`

