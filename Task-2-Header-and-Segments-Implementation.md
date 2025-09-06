# Task 2 — Header & Segments (PlanPanel)

Goal: Replace the two toggle buttons with a centered, pill‑style segmented control (MUI Tabs). Keep the Share menu as a right‑aligned action. No new functionality.

Files to touch
- `ui/src/pages/AgentPage/components/plan/PlanPanel.tsx`
- (Optional polish) `ui/src/theme.tsx` for `MuiTabs`/`MuiTab` overrides

Steps
1) Import Tabs
- In `PlanPanel.tsx`, add:
  ```tsx
  import { Tabs, Tab } from '@mui/material';
  ```

2) Replace the left Button group
- Remove the two `Button`s used for “Meal Plan” and “Shopping List”.
- Insert Tabs bound to `currentTab`/`onTabChange`:
  ```tsx
  <Tabs
    value={currentTab}
    onChange={(_, v) => onTabChange(v)}
    aria-label="Plan panel tabs"
    sx={{ minHeight: 40, borderRadius: 999, px: 0.5,
          backgroundColor: 'background.paper',
          border: (t) => `1px solid ${t.palette.divider}` }}
  >
    <Tab label="Meal Plan" value={0} />
    <Tab label="Shopping List" value={1} disabled={!hasShopping} />
  </Tabs>
  ```

3) Center the Tabs, keep actions on right
- Replace the header row container with a 3‑column grid to keep Tabs centered:
  ```tsx
  <Box sx={{ ...styles.sectionHeader, display: 'grid',
             gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
    <Box />
    {/* Tabs block from step 2 */}
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <ShareMenu ... />
    </Box>
  </Box>
  ```

4) Remove button‑specific styles
- Delete any `sx` using `colors.apricot` or variants from the old Buttons.
- Do not add new actions; ShareMenu remains unchanged.

5) Optional theme polish
- If the indicator should fill the pill, set in `ui/src/theme.tsx`:
  ```ts
  components: {
    MuiTabs: { styleOverrides: { indicator: { height: '100%', borderRadius: 999 } } },
    MuiTab:  { styleOverrides: { root: { minHeight: 40, padding: '8px 16px' } } },
  }
  ```

Acceptance
- Tabs are centered; Share menu is right‑aligned.
- “Shopping List” tab is disabled when `hasShopping` is false.
- No apricot button styles remain; visual matches theme.

Commands
- Visual check: `cd ui && yarn start`
- Full test run (from repo root): `yarn test`

