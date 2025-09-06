# Task 1 — Theme Foundation: Step‑by‑Step Implementation Plan

This plan describes exactly how to implement the theme foundation in Material UI (MUI) to establish the earthy, text‑first look. No new functionality is added; this is purely styling and structure.

## Overview
- Keep MUI (Core v5) and introduce a custom theme with palette, typography, shape, shadows, and initial component overrides.
- Apply the theme app‑wide via `ThemeProvider` and `CssBaseline`.
- Targeted overrides: `Card`, `Chip`, `Tabs`/`Tab`, `Button`, `Paper`, `Divider`.

## Prerequisites
- Ensure the UI package builds and tests pass locally.
- Confirm MUI v5 is installed and used in the project.

## File Map (expected)
- UI app root: `ui/`
- App entry: `ui/src/index.tsx` (or `ui/src/main.tsx`)
- New theme file: `ui/src/theme.ts`

---

## Steps

0) Remove existing theming (cleanup/migration)
- Existing setup lives in `ui/src/theme.tsx` and is wired in `ui/src/index.tsx`.
- In `ui/src/index.tsx`:
  - Remove the Google Fonts injection block that appends a `<link>` tag for Montserrat/Playfair.
  - Change `import theme from './theme'` to `import { theme } from './theme'` (named export).
- Replace the legacy theme module:
  - Delete `ui/src/theme.tsx` (e.g., to `theme.legacy.tsx`).
  - Remove any `declare module '@mui/material/styles'` augmentations for custom Typography variants or Palette keys.
  - Remove `responsiveFontSizes` usage tied to the old theme.
- Search and migrate any usages of legacy customizations (if present):
  - Custom Typography variants: `variant="cardTitle"`, `variant="recipeHeading"`, `variant="dayHeader"`, `variant="mealEffort"` → map to core variants: `h6`/`subtitle1`/`body2` as appropriate.
  - Custom palette keys: `theme.palette.sage.*`, `theme.palette.natural.*` → map to `theme.palette.primary`, `theme.palette.background.paper`, and `theme.palette.divider`.
- After cleanup, proceed to create the new theme at `ui/src/theme.ts` (below).

1) Create theme module
- Add `ui/src/theme.ts` that exports a `theme` created with `createTheme`.
- Include palette, typography, shape, shadows, and component overrides in one place.

Example structure (reference when implementing):
```ts
// ui/src/theme.ts
import { createTheme, alpha } from '@mui/material/styles';

const sage = '#6C8F6B';
const sageDark = '#4E6E52';
const sageLight = '#8FAA89';
const terracotta = '#C56A4A';
const bg = '#F4F1EA';
const paper = '#FFFFFF';
const textPrimary = '#2E2A24';
const textSecondary = '#7B7A73';
const divider = '#E7E2DA';

export const theme = createTheme({
  palette: {
    primary: { main: sage, dark: sageDark, light: sageLight },
    secondary: { main: terracotta },
    background: { default: bg, paper },
    text: { primary: textPrimary, secondary: textSecondary },
    divider,
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    h6: { fontSize: 20, fontWeight: 600 }, // weekday headings
    subtitle1: { fontSize: 16, fontWeight: 500 }, // meal titles
    button: { fontSize: 14, fontWeight: 600, textTransform: 'none' },
    caption: { fontSize: 11, letterSpacing: 0.5, fontWeight: 600 }, // labels/chips
    body1: { fontSize: 16 },
    body2: { fontSize: 14 },
  },
  shape: { borderRadius: 12 },
  shadows: [
    'none',
    '0 2px 6px rgba(0,0,0,0.04)',
    '0 4px 12px rgba(0,0,0,0.06)',
    '0 6px 18px rgba(0,0,0,0.08)',
    ...Array(22).fill('none'),
  ] as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: bg },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: divider },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${divider}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          borderRadius: 12,
          transition: 'box-shadow 140ms ease, transform 140ms ease',
          '&:hover': { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
        containedPrimary: { boxShadow: 'none' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 10, fontWeight: 600 },
        sizeSmall: { height: 24 },
      },
      defaultProps: { size: 'small', variant: 'soft' as any },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40, borderRadius: 999, background: paper, border: `1px solid ${divider}` },
        indicator: { height: '100%', borderRadius: 999, backgroundColor: alpha(sage, 0.18) },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 40, padding: '8px 16px' },
      },
      defaultProps: { disableRipple: true },
    },
  },
});
```

2) Wire the theme at the app root
- Locate the UI entry file (commonly `ui/src/index.tsx`).
- Wrap the root `<App />` in `<ThemeProvider theme={theme}>` and render `<CssBaseline />` once near the top.

Checklist
- Import `ThemeProvider` and `CssBaseline` from `@mui/material`.
- Import `{ theme }` from `ui/src/theme`.
- Ensure there is only one `ThemeProvider` at the root (remove duplicates if present).

3) Verify build and smoke test UI
- Start the frontend: `cd ui && yarn start`.
- Confirm page background is oat (`#F4F1EA`) and buttons, tabs, chips reflect the new palette.

4) Tune component overrides (initial pass)
- Confirm Card borders and subtle hover shadow are visible.
- Ensure Tabs look like a pill segmented control (rounded container, filled indicator).
- Confirm Chip is compact; plan to use it for meal-type labels in a later task.

5) Keep the assistant panel unchanged
- Do not collapse or move the assistant panel; verify theme changes don’t alter its layout.

6) Tests
- Run from repo root: `yarn test`.
- If snapshots fail due to style changes in the UI suite, update them only after manual verification of visuals.
- Backend and other suites should remain unaffected; investigate only if failures are unrelated to this change.

7) Documentation
- Add any final palette adjustments back into `UI-Refresh-Plan.md` once locked.

## Acceptance Criteria
- App renders with the new earthy palette and typography.
- Cards, Tabs, Chips, Buttons, Paper, and Dividers show the intended styling.
- No functional changes introduced; all test suites pass.
- Legacy theming removed: `ui/src/theme.tsx` deleted (or archived), `index.tsx` no longer injects Google Fonts, no custom Typography/Palette augmentations remain.

## Rollback Plan
- Restore the original `ui/src/theme.tsx` and revert `index.tsx` import and font injection.
- Revert `ui/src/theme.ts` and the `ThemeProvider` wiring change in the entry file.
- Re-run `yarn test` to confirm baseline behavior.

