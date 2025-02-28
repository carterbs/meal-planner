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
    Paper
} from '@mui/material';
import { MealPlanTab } from './components/MealPlanTab';
import { MealManagementTab } from './components/MealManagementTab';
import { Toast } from './components/Toast';
import { DatabaseConnectionError } from './components/DatabaseConnectionError';

const App: React.FC = () => {
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
            console.error('Error checking database connection:', error);
            setDbConnected(false);
        } finally {
            setIsLoading(false);
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
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh'
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    // Show database connection error if connection failed
    if (dbConnected === false) {
        return <DatabaseConnectionError onRetry={checkDbConnection} />;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static" color="default" elevation={0}>
                <Container maxWidth="lg">
                    <Toolbar disableGutters>
                        <Typography variant="h5" component="h1" sx={{ flexGrow: 1, fontWeight: 500 }}>
                            Meal Planner
                        </Typography>
                        <Tabs
                            value={activeTab}
                            onChange={(_, newValue) => setActiveTab(newValue)}
                            indicatorColor="primary"
                            textColor="primary"
                        >
                            <Tab label="Meal Plan" />
                            <Tab label="Meal Management" />
                        </Tabs>
                    </Toolbar>
                </Container>
            </AppBar>

            <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
                <Paper elevation={2} sx={{ p: 3 }}>
                    {activeTab === 0 && <MealPlanTab showToast={showToast} />}
                    {activeTab === 1 && <MealManagementTab showToast={showToast} />}
                </Paper>
            </Container>

            <Toast message={toast} />
        </Box>
    );
};

export default App;