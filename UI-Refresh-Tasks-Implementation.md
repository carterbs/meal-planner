# UI Refresh — Implementation Plans (Tasks 2–6)

This document provides concrete, file‑level steps to implement the remaining tasks from `UI-Refresh-Plan.md`. Task 1 (Theme Foundation) is complete and omitted here.

Conventions
- All paths are relative to the repo root.
- UI source lives under `ui/src`.
- Run `yarn test` from the repo root after completing each task.

---

## Task 2 — Header & Segments (PlanPanel)
Goal: Replace the two toggle buttons with a centered, pill‑style segmented control (MUI Tabs). Keep the Share menu as a right‑aligned action.

Files to touch
- `ui/src/pages/AgentPage/components/plan/PlanPanel.tsx`
- (Theme is already present; if needed for polish) `ui/src/theme.tsx`

Steps
1) Swap Buttons for Tabs
   - Import `Tabs` and `Tab` from `@mui/material`.
   - Replace the left `Button` group with:
     ```tsx
     <Tabs
       value={currentTab}
       onChange={(_, v) => onTabChange(v)}
       aria-label="Plan panel tabs"
       sx={{ minHeight: 40, borderRadius: 999 }}
     >
       <Tab label="Meal Plan" value={0} />
       <Tab label="Shopping List" value={1} disabled={!hasShopping} />
     </Tabs>
     ```

2) Center the segmented control
   - Replace the current header layout with a three‑section layout to keep the tabs centered and the action bar on the right:
     ```tsx
     <Box sx={{ ...styles.sectionHeader, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
       <Box />
       {/* Centered Tabs */}
       {/* Tabs from step 1 here */}
       <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
         <ShareMenu ... />
       </Box>
     </Box>
     ```

3) Remove button‑specific `sx` and colors
   - Delete uses of `colors.apricot` on the old Buttons.
   - Rely on theme overrides for `MuiTabs`/`MuiTab`. If needed, add a light border/background to the Tabs with `sx`:
     ```tsx
     sx={{ backgroundColor: 'background.paper', border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 999, px: 0.5 }}
     ```

4) Polish (optional)
   - If the active indicator should fill the pill, either:
     - Use theme overrides for `MuiTabs.indicator` to `height: '100%'` and rounded corners, or
     - Apply a custom `Tab` `sx` with selected background using `&.Mui-selected`.

Acceptance
- Tabs are centered; Share menu sits on the right.
- Shopping List tab is disabled when there is no shopping list.
- Visual style matches the theme (no apricot button styles remain).

---

## Task 3 — Meal Cards (text‑first, no emojis)
Goal: Replace effort emojis with cleaner, text‑first meal rows and add subtle meal‑type chips. Keep cards light with soft borders.

Files to touch
- `ui/src/pages/AgentPage/components/plan/MealPlanDisplay.tsx`
- (Optional component extraction) `ui/src/pages/AgentPage/components/plan/MealTypeChip.tsx`
- Tests later in Task 6

Steps
1) Remove effort emojis
   - Delete `effortIcons` and `getEffortIcon` export.
   - Remove the trailing emoji Box inside the meal row:
     ```tsx
     {e.meal && (
       <Box sx={{ fontSize: '1.1rem' }}>{getEffortIcon(e.meal.effort)}</Box>
     )}
     ```

2) Add meal‑type chip
   - Add `Chip` from `@mui/material` and render it inline before the meal name for each entry:
     ```tsx
     <Chip label={capitalize(e.mealType)} size="small" color="primary" variant="outlined" sx={{ mr: 0.75, borderRadius: 10 }} />
     ```
   - If you prefer to keep labels on their own line, replace the existing small‑caps label Box with the Chip.

3) Tidy the meal row
   - Ensure the meal line uses a single row layout:
     ```tsx
     <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
       {/* Chip */}
       {/* Meal name span */}
     </Box>
     ```
   - Keep highlight styles (left border + fade animation) as they are.

4) Card surface and spacing
   - Keep the day container as a soft `Box` with `backgroundColor: activeColors.cardBg`, a 1px border, and `borderRadius: 16`.
   - Use `gap: 1` across grid and rows for 8/16/24 rhythm consistency.

5) Remove default hard‑coded colors (prep for Task 5)
   - Where possible, align with `colors` prop or theme tokens and reduce inline `#hex` usage.

Acceptance
- No emoji appear anywhere in the meal rows.
- A compact meal‑type chip is present and readable.
- Overall card look is lighter, with consistent spacing.

---

## Task 4 — Week Layout (sticky headers + rhythm)
Goal: Improve scanability with sticky weekday headers and consistent vertical rhythm.

Files to touch
- `ui/src/pages/AgentPage/components/plan/MealPlanDisplay.tsx`

Steps
1) Make weekday headers sticky
   - On the Box that renders the day label (currently above the card), add:
     ```tsx
     sx={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'background.default', py: 0.5 }}
     ```
   - Ensure the scroll container is the top `Box` in `MealPlanDisplay` (it already has `overflow: 'auto'`).

2) Add faint dividers between days
   - After each day section (except the last), insert `<Divider sx={{ opacity: 0.5 }} />` with margin `my: 1`.

3) Enforce spacing rhythm
   - Use `gap: 1.5` (12px) between day sections and `gap: 1` (8px) within cards.
   - Avoid mixed margins and gaps; prefer container `gap` where feasible.

Acceptance
- Day labels remain visible while scrolling.
- Subtle dividers separate days without adding clutter.
- Spacing is consistent at 8/16/24 multiples.

---

## Task 5 — Consistency Sweep (labels, tokens, cleanup)
Goal: Standardize labels and colors; remove residual emoji usage; ensure theme/tokens are used consistently.

Files to touch
- `ui/src/pages/AgentPage/components/plan/MealPlanDisplay.tsx`
- `ui/src/pages/AgentPage/components/plan/PlanPanel.tsx`
- `ui/src/theme.tsx` (if minor token adjustments are needed)

Steps
1) Capitalization
   - Render meal types as `Breakfast`, `Lunch`, `Dinner` (capitalize from `e.mealType`).
   - Use sentence case for meal names; do not force uppercase.

2) Remove default color fallbacks
   - In `MealPlanDisplay.tsx`, rely on `colors` (from `colorSchemes`) or `theme.palette` instead of inline hex codes.
   - Replace `'#a0a0a0'` and similar with `theme.palette.text.disabled` or a muted token.

3) Search for emojis project‑wide and remove/replace
   - Remove any remaining effort‑related emoji references in UI code and tests.

4) Align borders and radii
   - Ensure card and inner row radii align with theme (12 for cards, 10 for inner rows/chips).
   - Borders should use `theme.palette.divider` or `colors.border` consistently.

Acceptance
- Labels and capitalization are consistent.
- No hard‑coded colors remain where tokens exist.
- No emoji usage remains in the UI.

---

## Task 6 — Tests & Docs (update after visual changes)
Goal: Update unit tests to reflect the new components and removed emojis; document final palette choices.

Files to touch
- `ui/src/pages/AgentPage/components/plan/PlanPanel.test.tsx`
- `ui/src/pages/AgentPage/components/plan/MealPlanDisplay.test.tsx`
- `UI-Refresh-Plan.md` (reflect any final palette tweaks)

Steps
1) Update PlanPanel tests for Tabs
   - Replace role queries from `button` to `tab`:
     ```ts
     const planTab = screen.getByRole('tab', { name: 'Meal Plan' });
     const listTab = screen.getByRole('tab', { name: 'Shopping List' });
     ```
   - Keep the disabled assertion for Shopping List when `!hasShopping`.
   - Use `user.click(listTab)` and assert `onTabChange(1)` still fires.

2) Remove getEffortIcon tests
   - Delete the `describe('getEffortIcon', ...)` block in `MealPlanDisplay.test.tsx`.
   - Ensure remaining highlight tests still pass; they should be unaffected.

3) Update any expectations tied to emojis
   - If a test looked for emoji characters next to meal names, remove those expectations.

4) Run and fix
   - `yarn test` at repo root.
   - Resolve any snapshot/test regressions caused by component swaps (Tabs/Chip). Prefer semantic queries (`role`, `name`) over snapshots.

5) Docs
   - Update `UI-Refresh-Plan.md` if the final palette or component decisions changed during implementation.

Acceptance
- All UI tests pass with Tabs and chip‑based meal rows.
- No tests reference emojis or the removed `getEffortIcon` helper.

---

Notes
- Keep the assistant panel unchanged throughout these tasks.
- Avoid introducing new functionality; these are styling and component swaps only.
- If a theme token is missing, add it in `ui/src/theme.tsx` rather than hard‑coding colors in components.

