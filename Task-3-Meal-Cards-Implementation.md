# Task 3 — Meal Cards (Text‑First, No Emojis)

Goal: Replace effort emojis with cleaner, text‑first meal rows and add subtle meal‑type chips. Keep cards light with soft borders. No new features.

Files to touch
- `ui/src/pages/AgentPage/components/plan/MealPlanDisplay.tsx`
- (Optional extraction) `ui/src/pages/AgentPage/components/plan/MealTypeChip.tsx`

Steps
1) Remove effort emojis
- Delete the `effortIcons` map and the `getEffortIcon` export.
- Remove the trailing emoji `<Box>` inside each meal row.

2) Add meal‑type chip
- Import `Chip` from `@mui/material`.
- Render a chip before the meal name in each entry row:
  ```tsx
  <Chip
    label={e.mealType.charAt(0).toUpperCase() + e.mealType.slice(1)}
    size="small"
    variant="outlined"
    color="primary"
    sx={{ borderRadius: 10, mr: 0.75 }}
  />
  ```
- Replace the existing small‑caps label Box if you prefer a single, tighter row.

3) Tidy the meal row layout
- Wrap chip + name in a single line with spacing:
  ```tsx
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    {/* Chip */}
    <Box component="span" data-testid={`meal-name-${key}`} ...>
      {e.meal ? e.meal.name : '---'}
    </Box>
  </Box>
  ```
- Preserve highlight animation and left border style for changed meals.

4) Card surface & spacing
- Keep day container styles: soft background, 1px border, `borderRadius: 16`, and `gap: 1` within the grid.
- Avoid hard‑coded hex colors; prefer `colors` prop or `theme.palette`.

5) Optional: Extract `MealTypeChip`
- If reusing elsewhere, create `MealTypeChip.tsx` that returns the Chip with a consistent style.

Acceptance
- No emoji appear in meal rows.
- Compact, readable meal‑type chips are present.
- Cards feel lighter with consistent spacing and borders.

Commands
- Visual check: `cd ui && yarn start`
- Full test run (from repo root): `yarn test`

