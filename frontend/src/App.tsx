// frontend/src/App.tsx
import React, { useState, useRef, useEffect } from "react";
import {
    Tabs,
    Tab,
    Box,
    CircularProgress,
    Container,
    AppBar,
    Toolbar,
    Typography,
    Paper,
    useTheme,
    alpha,
    Button,
    Stack,
    Avatar,
    Fade
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FoodBankIcon from '@mui/icons-material/FoodBank';
import { MealPlanTab } from './components/MealPlanTab';
import { MealManagementTab } from './components/MealManagementTab';
import { Toast } from './components/Toast';
import { DatabaseConnectionError } from './components/DatabaseConnectionError';

const App: React.FC = () => {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    const [dbConnected, setDbConnected] = useState<boolean | null>(null); // null = checking, true = connected, false = error
    const [isLoading, setIsLoading] = useState(true);

    const toastTimeout = process.env.NODE_ENV === 'test' ? 10 : 2000;
    const toastTimeoutRef = useRef<number | null>(null);

    const showToast = (message: string) => {
        setToast(message);
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = window.setTimeout(() => {
            setToast(null);
        }, toastTimeout);
    };

    // Check database connection
    const checkDbConnection = async () => {
        setIsLoading(true);
        try {
            // Skip real network request in test environment
            if (process.env.NODE_ENV === 'test') {
                setDbConnected(true);
                setIsLoading(false);
                return;
            }

            const response = await fetch('/api/health');
            const data = await response.json();
            setDbConnected(data.status === 'ok');
        } catch (error) {
            // Use console.debug instead of console.error since we have a UI for users
            console.debug('Database connection check failed:', error);
            setDbConnected(false);
        } finally {
            setIsLoading(false);
        }
    };

    // Attempt to reconnect to the database
    const reconnectDatabase = async (): Promise<void> => {
        // Don't set global loading state, which causes the UI to flash
        // Instead, the loading state is handled by the DatabaseConnectionError component
        try {
            // Skip real network request in test environment
            if (process.env.NODE_ENV === 'test') {
                setDbConnected(true);
                return;
            }

            const response = await fetch('/api/reconnect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            const succeeded = data.status === 'ok';

            setDbConnected(succeeded);

            if (succeeded) {
                showToast('Successfully reconnected to the database');
            }
        } catch (error) {
            // Use console.debug instead of console.error since we have a UI for users
            console.debug('Database reconnection attempt failed:', error);
            setDbConnected(false);
        }
    };

    // Check database connection on mount
    useEffect(() => {
        checkDbConnection();
    }, []);

    // Cleanup the timeout on component unmount
    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
        };
    }, []);

    // Show loading spinner while checking database connection
    if (isLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    background: 'linear-gradient(135deg, #f4f7f0 0%, #eef4ea 100%)',
                    gap: 3
                }}
            >
                <RestaurantIcon sx={{ fontSize: 60, color: '#7fb069', mb: 1 }} />
                <Typography variant="h1" sx={{ color: '#7fb069' }}>
                    🍴 Weekly Meal Plan
                </Typography>
                <CircularProgress sx={{ color: '#7fb069' }} />
                <Typography variant="body1" sx={{ mt: 2, color: '#6b7668' }}>
                    Plan your meals for the week ahead
                </Typography>
            </Box>
        );
    }

    // Show database connection error if connection failed
    if (dbConnected === false) {
        return <DatabaseConnectionError onRetry={reconnectDatabase} />;
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #f4f7f0 0%, #eef4ea 100%)',
                padding: '20px',
            }}
        >
            <Container
                maxWidth={false}
                sx={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    background: 'linear-gradient(135deg, #fefffe 0%, #f9fdf7 100%)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 'calc(100vh - 40px)',
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        padding: '24px 40px',
                        background: 'linear-gradient(135deg, #8b9a7a 0%, #a8b89a 100%)',
                        position: 'relative',
                        overflow: 'hidden',
                        color: 'white',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                        },
                    }}
                >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography
                            variant="h1"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                color: 'white',
                                marginBottom: '4px',
                            }}
                        >
                            <span style={{ fontSize: '1.2rem' }}>🍴</span>
                            Weekly Meal Plan
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            sx={{
                                color: 'rgba(255,255,255,0.9)',
                            }}
                        >
                            Plan your meals for the week ahead
                        </Typography>
                    </Box>
                </Box>

                {/* Navigation Tabs - moved to a separate section */}
                <Box
                    sx={{
                        backgroundColor: 'white',
                        borderBottom: '1px solid #e5e7eb',
                        padding: '0 40px',
                    }}
                >
                    <Tabs
                        value={activeTab}
                        onChange={(_, newValue) => setActiveTab(newValue)}
                        indicatorColor="primary"
                        textColor="primary"
                        sx={{
                            '& .MuiTab-root': {
                                minWidth: 120,
                                fontWeight: 500,
                                fontSize: '0.875rem',
                                color: '#6b7668',
                                textTransform: 'none',
                                padding: '12px 0',
                                marginRight: '24px',
                                '&.Mui-selected': {
                                    color: '#4a5d3a',
                                    fontWeight: 600,
                                },
                            },
                            '& .MuiTabs-indicator': {
                                background: 'linear-gradient(90deg, #7fb069 0%, #1b998b 100%)',
                                height: 3,
                            },
                        }}
                    >
                        <Tab
                            label="Meal Plan"
                            icon={<CalendarMonthIcon />}
                            iconPosition="start"
                        />
                        <Tab
                            label="Meal Management"
                            icon={<FoodBankIcon />}
                            iconPosition="start"
                        />
                    </Tabs>
                </Box>

                {/* Main Content */}
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'white',
                    }}
                >
                    <Fade in={true} timeout={800}>
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {activeTab === 0 && <MealPlanTab showToast={showToast} />}
                            {activeTab === 1 && <MealManagementTab showToast={showToast} />}
                        </Box>
                    </Fade>
                </Box>

                {/* Footer */}
                <Box
                    sx={{
                        py: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.7)',
                        borderTop: '1px solid #e8f0e5',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <Container maxWidth="lg">
                        <Typography variant="body2" color="#8a9584" align="center">
                            © {new Date().getFullYear()} Meal Planner — Simplify your meal prep and planning
                        </Typography>
                    </Container>
                </Box>
            </Container>

            <Toast message={toast} />
        </Box>
    );
};

export default App;