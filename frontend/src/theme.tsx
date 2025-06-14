import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// Define color palette following the "crunchy mom aesthetic" style guide
const primaryColor = '#7fb069'; // Sage Green
const secondaryColor = '#1b998b'; // Teal
const dustySage = '#8b9a7a'; // Header background start
const softOlive = '#a8b89a'; // Header background end
const warmCream = '#fefffe'; // Primary background
const lightSage = '#f9fdf7'; // Container background
const offWhite = '#f4f7f0'; // Body background start
const paleSage = '#eef4ea'; // Body background end
const darkGreen = '#4a5d3a'; // Primary text
const greenGray = '#6b7668'; // Secondary text
const mutedGreen = '#8a9584'; // Tertiary text
const borderColor = '#e8f0e5';

// Declare custom fonts
declare module '@mui/material/styles' {
    interface TypographyVariants {
        cardTitle: React.CSSProperties;
        recipeHeading: React.CSSProperties;
        dayHeader: React.CSSProperties;
        mealName: React.CSSProperties;
        mealEffort: React.CSSProperties;
    }

    interface TypographyVariantsOptions {
        cardTitle?: React.CSSProperties;
        recipeHeading?: React.CSSProperties;
        dayHeader?: React.CSSProperties;
        mealName?: React.CSSProperties;
        mealEffort?: React.CSSProperties;
    }
}

declare module '@mui/material/Typography' {
    interface TypographyPropsVariantOverrides {
        cardTitle: true;
        recipeHeading: true;
        dayHeader: true;
        mealName: true;
        mealEffort: true;
    }
}

// Create base theme
let theme = createTheme({
    palette: {
        primary: {
            main: primaryColor,
            light: alpha(primaryColor, 0.8),
            dark: '#6fa055',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: secondaryColor,
            light: alpha(secondaryColor, 0.8),
            dark: '#178a7a',
            contrastText: '#FFFFFF',
        },
        background: {
            default: paleSage,
            paper: warmCream,
        },
        text: {
            primary: darkGreen,
            secondary: greenGray,
        },
        error: {
            main: '#D32F2F',
        },
        warning: {
            main: '#e09e60',
        },
        info: {
            main: secondaryColor,
        },
        success: {
            main: primaryColor,
        },
        divider: borderColor,
    },
    typography: {
        fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            'sans-serif',
        ].join(','),
        h1: {
            fontSize: '1.5rem',
            fontWeight: 600,
            color: darkGreen,
            letterSpacing: '-0.01em',
        },
        h2: {
            fontSize: '1.3rem',
            fontWeight: 600,
            color: darkGreen,
        },
        h3: {
            fontSize: '1.1rem',
            fontWeight: 600,
            color: darkGreen,
        },
        h4: {
            fontSize: '1rem',
            fontWeight: 600,
            color: darkGreen,
        },
        h5: {
            fontSize: '0.875rem',
            fontWeight: 600,
            color: darkGreen,
        },
        h6: {
            fontSize: '0.75rem',
            fontWeight: 600,
            color: darkGreen,
        },
        subtitle1: {
            fontSize: '0.875rem',
            fontWeight: 500,
            color: greenGray,
        },
        subtitle2: {
            fontSize: '0.75rem',
            fontWeight: 500,
            color: mutedGreen,
        },
        body1: {
            fontSize: '0.875rem',
            fontWeight: 500,
            lineHeight: 1.6,
            color: darkGreen,
        },
        body2: {
            fontSize: '0.75rem',
            fontWeight: 500,
            color: greenGray,
        },
        button: {
            fontSize: '0.875rem',
            fontWeight: 500,
            letterSpacing: '0.01em',
            textTransform: 'none',
        },
        // Custom variants following the style guide
        cardTitle: {
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: darkGreen,
        },
        recipeHeading: {
            fontSize: '1.2rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: darkGreen,
        },
        dayHeader: {
            fontSize: '1.1rem',
            fontWeight: 600,
            color: darkGreen,
        },
        mealName: {
            fontSize: '0.875rem',
            fontWeight: 500,
            color: darkGreen,
            lineHeight: 1.4,
        },
        mealEffort: {
            fontSize: '0.75rem',
            color: mutedGreen,
        },
    },
    shape: {
        borderRadius: 12,
    },
    shadows: [
        'none',
        '0 4px 15px rgba(127, 176, 105, 0.08)',
        '0 8px 25px rgba(127, 176, 105, 0.15)',
        '0 10px 40px rgba(0, 0, 0, 0.1)',
        '0 20px 60px rgba(0,0,0,0.08)',
        '0 4px 15px rgba(127, 176, 105, 0.05)',
        '0 2px 8px rgba(127, 176, 105, 0.1)',
        '0 4px 15px rgba(127, 176, 105, 0.3)',
        '0 6px 20px rgba(127, 176, 105, 0.4)',
        '0 6px 20px rgba(0,0,0,0.15)',
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
                    background: `linear-gradient(135deg, ${dustySage} 0%, ${softOlive} 100%)`,
                    boxShadow: 'none',
                    borderBottom: `1px solid ${borderColor}`,
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                        pointerEvents: 'none',
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    padding: '10px 20px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                    },
                },
                contained: {
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(127, 176, 105, 0.3)',
                    '&:hover': {
                        background: `linear-gradient(135deg, #6fa055 0%, #178a7a 100%)`,
                        boxShadow: '0 6px 20px rgba(127, 176, 105, 0.4)',
                    },
                },
                outlined: {
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    color: '#6b7280',
                    border: '1px solid #e2e8f0',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                        borderColor: '#d1d5db',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    background: `linear-gradient(135deg, ${warmCream} 0%, #fbfef9 100%)`,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 12,
                    boxShadow: '0 4px 15px rgba(127, 176, 105, 0.08)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    overflow: 'hidden',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(127, 176, 105, 0.15)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    background: `linear-gradient(135deg, ${warmCream} 0%, ${lightSage} 100%)`,
                    borderRadius: 16,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
                    border: `1px solid ${borderColor}`,
                },
                elevation1: {
                    boxShadow: '0 4px 15px rgba(127, 176, 105, 0.08)',
                },
                elevation2: {
                    boxShadow: '0 8px 25px rgba(127, 176, 105, 0.15)',
                },
                elevation3: {
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
                },
            },
        },
        MuiContainer: {
            styleOverrides: {
                root: {
                    maxWidth: '1400px !important',
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: `1px solid ${borderColor}`,
                    padding: '16px',
                },
                head: {
                    background: `linear-gradient(135deg, #fafcf8 0%, #f6faf3 100%)`,
                    fontWeight: 600,
                    color: darkGreen,
                    borderBottom: `1px solid ${borderColor}`,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    color: 'rgba(255,255,255,0.9)',
                    '&.Mui-selected': {
                        color: 'white',
                        fontWeight: 600,
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    background: 'white',
                    height: 3,
                },
            },
        },
    },
});

// Add custom color properties for the crunchy mom aesthetic
declare module '@mui/material/styles' {
    interface Palette {
        sage: {
            light: string;
            main: string;
            dark: string;
        };
        natural: {
            cream: string;
            sage: string;
            border: string;
        };
    }

    interface PaletteOptions {
        sage?: {
            light?: string;
            main?: string;
            dark?: string;
        };
        natural?: {
            cream?: string;
            sage?: string;
            border?: string;
        };
    }
}

// Augment the theme with custom colors
theme = createTheme(theme, {
    palette: {
        sage: {
            light: lightSage,
            main: primaryColor,
            dark: dustySage,
        },
        natural: {
            cream: warmCream,
            sage: lightSage,
            border: borderColor,
        },
    },
});

// Make theme responsive
theme = responsiveFontSizes(theme);

export default theme; 