# Task 5 — Consistency Sweep (Labels, Tokens, Cleanup)

Goal: Standardize labels and colors; remove residual emoji usage; ensure theme/tokens are used consistently. No new features.

Files to touch
- `ui/src/pages/AgentPage/components/plan/MealPlanDisplay.tsx`
- `ui/src/pages/AgentPage/components/plan/PlanPanel.tsx`
- (If needed) `ui/src/theme.tsx`

Steps
1) Capitalization and labels
- Render meal types as `Breakfast`, `Lunch`, `Dinner` (capitalize `e.mealType`).
- Keep meal names in sentence case (do not force uppercase).

2) Replace hard‑coded colors
- In `MealPlanDisplay.tsx`, use the `colors` prop or `theme.palette` tokens instead of hex values (e.g., `text.disabled` for muted text, `divider` for borders).
- Ensure inner row borders use `theme.palette.divider` or `colors.border` consistently.

3) Remove any remaining emojis
- Search project‑wide for emoji characters used in the UI and tests; remove or replace.

4) Align radii and spacing
- Cards: radius 12 or 16 (per theme/container), inner rows/chips: radius 10.
- Spacing: use `gap` where possible with 8/16/24 increments.

5) Quick visual audit
- Check that chips, tabs, cards, and dividers share the same tone and density across screens.

Acceptance
- No stray emojis in UI or tests.
- Color and border usage align with tokens; minimal hex values inline.
- Labels and capitalization are consistent across components.

Commands
- Visual check: `cd ui && yarn start`
- Full test run (from repo root): `yarn test`

