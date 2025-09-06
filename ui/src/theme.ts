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
    fontFamily:
      'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
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
        root: {
          minHeight: 40,
          borderRadius: 999,
          background: paper,
          border: `1px solid ${divider}`,
        },
        indicator: {
          height: '100%',
          borderRadius: 999,
          backgroundColor: alpha(sage, 0.18),
        },
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
