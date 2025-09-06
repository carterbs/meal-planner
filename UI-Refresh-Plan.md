# UI Refresh Plan (MUI, Theme‑First)

This document outlines incremental, low‑risk tasks to refresh the app’s look and feel using Material UI (MUI) without adding new functionality. The goal is a calmer, earthy aesthetic that feels noticeably different while staying text‑first and keeping the assistant panel visible.

## Design Direction

- Earthy, calm vibe: soft sage, moss, oat, terracotta accents
- Text‑first; remove emojis; no photos or dark mode
- Keep assistant panel; focus changes on the plan area
- Generous whitespace, subtle borders, soft elevation

## Constraints

- Keep using MUI (no library switch in this phase)
- No new features (e.g., no new drag/drop)
- Ignore accessibility/keyboard work for now
- Do not add calorie/prep metadata

---

## Task 1 — Theme Foundation (start here)

Create a custom MUI theme with tokens and light component overrides.

Deliverables

- New theme module: `ui/src/theme.ts` (or existing theme file)
- App wrapped with `ThemeProvider` + `CssBaseline` at the root
- Initial overrides: Card, Chip, Tabs, Button, Paper, Divider

Palette (final “crunchy” set)

- primary.main: `#6C8F6B` (sage/moss)
- primary.dark: `#4E6E52`
- primary.light: `#8FAA89`
- secondary.main: `#C56A4A` (terracotta)
- background.default: `#F4F1EA`
- background.paper: `#FFFFFF`
- text.primary: `#2E2A24`
- text.secondary: `#7B7A73`
- divider: `#E7E2DA`

Typography

- Family: Inter, system-ui, sans-serif
- Day heading: 20/600; Meal title: 16/500; Labels: 11 uppercase (slight tracking)
- Button text: 14/600; Body: 16/400 and 14/400

Shape & Shadows

- shape.borderRadius: 12
- Subtle wide-blur shadows for elevations 1–3

Initial Component Overrides

- MuiCard: 1px divider border, radius 12, soft hover shadow
- MuiChip: compact small size with gentle tints for meal types
- MuiTabs/MuiTab: pill segmented control (rounded, filled indicator)
- MuiButton: warm contained/outlined variants tuned to palette
- MuiPaper & MuiDivider: warm neutrals matching palette
- CssBaseline: set page bg to background.default

Acceptance

- App builds and renders with new theme
- No functional changes; tests pass

Status: Implemented — earthy MUI theme applied across the application.

---

## Task 2 — Header & Segments

Restyle the top switch as a centered segmented control using MUI Tabs; move share/download into a small right-aligned action bar.

Acceptance

- Clearly centered segments; active state filled with primary
- Action icons grouped at top-right with tooltips

Status: Implemented — header uses centered tabs with right-aligned action menu.

---

## Task 3 — Meal Cards

Replace emojis with meal-type chips and refine card visuals.

Changes

- Add `MealTypeChip` (Breakfast/Lunch/Dinner) using subdued tones
- Card header row: meal-type chip + title; light border and padding rhythm
- Remove emojis everywhere

Acceptance

- Cards feel lighter; chips replace emojis consistently

Status: Implemented — meal rows use `MealTypeChip` components with outlined primary chips and no effort emojis. Cards retain soft borders and spacing.

---

## Task 4 — Week Layout

Improve scanability without changing features.

Changes

- Make weekday headers sticky while scrolling the list
- Add faint dividers; enforce 8/16/24 spacing rhythm

Acceptance

- Day labels remain visible on scroll; spacing consistent

Status: Implemented — weekday headers stay sticky with subtle dividers and consistent 8/16 rhythm.

---

## Task 5 — Consistency Sweep

Standardize labels, capitalization, spacing; ensure theme tokens are used across components.

Changes

- Capitalize meal type labels while keeping meal names in sentence case
- Replace remaining inline colors with theme tokens and align 8/16 spacing
- Remove leftover emojis from meal plan tests

Acceptance

- No stray colors/shadows; labels consistent (sentence case for titles, uppercase labels)

Status: Implemented — meal plan uses theme tokens, standardized spacing, and emoji-free labels.

---

## Task 6 — Tests & Docs

Update affected snapshots/unit tests and document the palette and components.

Commands

- Run from repo root: `yarn test`

Acceptance

- All tests pass; this document reflects the final theme choices

Status: Implemented — tests updated for tabbed header and chip-based rows; palette locked in docs.

---

## Notes

- If we later consider a softer baseline with minimal churn, we can layer MUI Joy tokens alongside Core; full library switches are out of scope here.
