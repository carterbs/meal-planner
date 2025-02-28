import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// Define color palette
const primaryColor = '#5E8B3F'; // Fresh sage green
const secondaryColor = '#E9773E'; // Warm terracotta
const backgroundLight = '#F8F6F2'; // Soft cream background
const backgroundDark = '#2D3133'; // Deep charcoal for dark mode

// Declare custom fonts
declare module '@mui/material/styles' {
    interface TypographyVariants {
        cardTitle: React.CSSProperties;
        recipeHeading: React.CSSProperties;
    }

    interface TypographyVariantsOptions {
        cardTitle?: React.CSSProperties;
        recipeHeading?: React.CSSProperties;
    }
}

declare module '@mui/material/Typography' {
    interface TypographyPropsVariantOverrides {
        cardTitle: true;
        recipeHeading: true;
    }
}

// Create base theme
let theme = createTheme({
    palette: {
        primary: {
            main: primaryColor,
            light: alpha(primaryColor, 0.8),
            dark: '#3A5A25',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: secondaryColor,
            light: alpha(secondaryColor, 0.8),
            dark: '#C45E2D',
            contrastText: '#FFFFFF',
        },
        background: {
            default: backgroundLight,
            paper: '#FFFFFF',
        },
        text: {
            primary: '#333333',
            secondary: '#666666',
        },
        error: {
            main: '#D32F2F',
        },
        warning: {
            main: '#EF8F33',
        },
        info: {
            main: '#4C94E8',
        },
        success: {
            main: '#4CAF50',
        },
        divider: '#E0E0E0',
    },
    typography: {
        fontFamily: [
            'Montserrat',
            '"Segoe UI"',
            'Roboto',
            'Arial',
            'sans-serif',
        ].join(','),
        h1: {
            fontFamily: 'Playfair Display, serif',
            fontWeight: 700,
            letterSpacing: '-0.01em',
        },
        h2: {
            fontFamily: 'Playfair Display, serif',
            fontWeight: 700,
            letterSpacing: '-0.01em',
        },
        h3: {
            fontFamily: 'Playfair Display, serif',
            fontWeight: 600,
        },
        h4: {
            fontFamily: 'Playfair Display, serif',
            fontWeight: 600,
        },
        h5: {
            fontFamily: 'Playfair Display, serif',
            fontWeight: 600,
        },
        h6: {
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 600,
        },
        subtitle1: {
            fontWeight: 500,
        },
        subtitle2: {
            fontWeight: 500,
        },
        body1: {
            fontSize: '1rem',
            lineHeight: 1.6,
        },
        button: {
            fontWeight: 600,
            letterSpacing: '0.03em',
            textTransform: 'none',
        },
        // Custom variants
        cardTitle: {
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
        },
        recipeHeading: {
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '1.2rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
        },
    },
    shape: {
        borderRadius: 10,
    },
    shadows: [
        'none',
        '0 2px 8px rgba(0, 0, 0, 0.04)',
        '0 3px 10px rgba(0, 0, 0, 0.06)',
        '0 5px 15px rgba(0, 0, 0, 0.08)',
        '0 8px 20px rgba(0, 0, 0, 0.1)',
        '0 10px 25px rgba(0, 0, 0, 0.12)',
        '0 12px 28px rgba(0, 0, 0, 0.14)',
        '0 14px 30px rgba(0, 0, 0, 0.16)',
        '0 16px 32px rgba(0, 0, 0, 0.18)',
        '0 18px 34px rgba(0, 0, 0, 0.2)',
        '0 20px 36px rgba(0, 0, 0, 0.22)',
        '0 22px 38px rgba(0, 0, 0, 0.24)',
        '0 24px 40px rgba(0, 0, 0, 0.26)',
        '0 26px 42px rgba(0, 0, 0, 0.28)',
        '0 28px 44px rgba(0, 0, 0, 0.3)',
        '0 30px 46px rgba(0, 0, 0, 0.32)',
        '0 32px 48px rgba(0, 0, 0, 0.34)',
        '0 34px 50px rgba(0, 0, 0, 0.36)',
        '0 36px 52px rgba(0, 0, 0, 0.38)',
        '0 38px 54px rgba(0, 0, 0, 0.4)',
        '0 40px 56px rgba(0, 0, 0, 0.42)',
        '0 42px 58px rgba(0, 0, 0, 0.44)',
        '0 44px 60px rgba(0, 0, 0, 0.46)',
        '0 46px 62px rgba(0, 0, 0, 0.48)',
        '0 48px 64px rgba(0, 0, 0, 0.5)',
    ],
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: '#FFFFFF',
                    backgroundImage: `linear-gradient(to right, ${alpha(primaryColor, 0.05)}, ${alpha(primaryColor, 0.1)})`,
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '8px 22px',
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(94, 139, 63, 0.2)',
                        transform: 'translateY(-1px)',
                        transition: 'all 0.2s',
                    },
                },
                contained: {
                    '&:active': {
                        boxShadow: '0 2px 6px rgba(94, 139, 63, 0.2)',
                        transform: 'translateY(0)',
                    },
                },
                outlined: {
                    borderWidth: 2,
                    '&:hover': {
                        borderWidth: 2,
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    '&:hover': {
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                        transform: 'translateY(-4px)',
                    },
                },
            },
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    padding: '24px',
                    '&:last-child': {
                        paddingBottom: '24px',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    padding: '16px 24px',
                },
                head: {
                    fontWeight: 600,
                    backgroundColor: alpha(primaryColor, 0.05),
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    overflow: 'hidden',
                    '& .MuiTabs-indicator': {
                        height: 3,
                        borderRadius: '3px 3px 0 0',
                    },
                },
                flexContainer: {
                    gap: 8,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    textTransform: 'none',
                    letterSpacing: '0.02em',
                    padding: '12px 24px',
                    borderRadius: '8px 8px 0 0',
                    transition: 'background-color 0.2s',
                    '&:hover': {
                        backgroundColor: alpha(primaryColor, 0.05),
                    },
                    '&.Mui-selected': {
                        fontWeight: 700,
                    },
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        '& fieldset': {
                            borderColor: '#E0E0E0',
                            transition: 'border-color 0.2s',
                        },
                        '&:hover fieldset': {
                            borderColor: primaryColor,
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: primaryColor,
                            borderWidth: 2,
                        },
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                outlined: {
                    borderRadius: 8,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    fontWeight: 500,
                    '&.MuiChip-colorPrimary': {
                        backgroundColor: alpha(primaryColor, 0.1),
                        color: primaryColor,
                    },
                    '&.MuiChip-colorSecondary': {
                        backgroundColor: alpha(secondaryColor, 0.1),
                        color: secondaryColor,
                    },
                },
            },
        },
    },
});

// Declare module augmentation for DataGrid components
declare module '@mui/material/styles' {
    interface Components {
        MuiDataGrid?: {
            styleOverrides?: {
                root?: React.CSSProperties | any;
            };
        };
    }
}

// Add DataGrid styling
theme = createTheme(theme, {
    components: {
        // @ts-ignore - MuiDataGrid is a valid component but TypeScript doesn't recognize it
        MuiDataGrid: {
            styleOverrides: {
                root: {
                    border: 'none',
                    borderRadius: 12,
                    '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: alpha(primaryColor, 0.05),
                        borderRadius: '12px 12px 0 0',
                    },
                    '& .MuiDataGrid-row': {
                        transition: 'background-color 0.2s, transform 0.2s',
                    },
                    '& .MuiDataGrid-row:hover': {
                        backgroundColor: alpha(primaryColor, 0.03),
                        transform: 'translateY(-1px)',
                    },
                },
            },
        },
    },
});

// Make fonts responsive
theme = responsiveFontSizes(theme);

export default theme; 