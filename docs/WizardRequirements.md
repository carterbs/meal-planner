# Meal Planner Day-by-Day Wizard — Developer Requirements (v1)

## Purpose
Create a step-through wizard that guides the user day-by-day to plan Breakfast, Lunch, and Dinner for a week. The wizard is mounted when visiting `/wizard`.

## Scope
- Front-end React/TypeScript only; reuse existing planner & shopping-list endpoints.
- Desktop-first; mobile postponed.
- Single shared plan, three meal types.

## Wizard Flow
1. **Start Screen**
   - Pre-select default meal types for the week (configurable toggle panel; BR/LU/DI default ON).
2. **Day Step** (repeats Mon→Sun)
   - Header: “Plan Monday” (progress bar Day 1/7).
   - Meal toggles: Breakfast | Lunch | Dinner (checkboxes) — unchecked = skip meal.
   - For each checked meal, show suggestion card with Accept / Shuffle / Manual Search.
   - Next button (disabled until all checked meals are accepted or skipped).
3. **Summary Step**
   - Shows 7×3 table of chosen meals and skipped slots.
   - Back button to any day.
   - Save & Generate Shopping List action.

## Interactions
| Component | Primary Actions |
|-----------|-----------------|
| Meal toggle | Check → show suggestion / Uncheck → mark skipped |
| Suggestion card | Accept ✔ • Shuffle ⟳ • Manual search 🔍 |
| Day footer | Next → next day • Back → previous day |
| Summary | Click a day → jump back to that step |

## Smart Defaults
- If a meal toggle is OFF for 3 previous weekdays, wizard pre-unchecks it on next weekday.
- Suggestions cached per meal when shuffled (max 3 alt calls per slot).

## Visual Specs
- Wide single-column layout (≈ 640 px).
- Progress bar top; Day header sticky.
- Colors: Accept=green, Shuffle=blue, Skip=gray.

## Shopping List Integration
- On Save & Generate, POST `/shopping-list/create`.
- If user revisits wizard and changes any day → flag “List out of date” banner on Summary.

## Acceptance Criteria
1. Wizard reachable at `/wizard`; landing shows Start screen.
2. User can skip Thursday Lunch in 1 click (uncheck) and proceed.
3. Completing all 7 days enables Summary; table matches selections.
4. Save & Generate hits `/shopping-list/create`; banner appears if subsequent edit.
5. Refresh mid-wizard restores progress to same step.

## Out-of-Scope
- Multi-person planning.
- Mobile layout.
- Nutrition metrics display.
