// frontend/src/App.tsx
import React, { useState, useRef, useEffect } from "react";
import { Tabs, Tab } from '@mui/material';
import { MealPlanTab } from './components/MealPlanTab';
import { MealManagementTab } from './components/MealManagementTab';
import { Toast } from './components/Toast';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [toast, setToast] = useState<string | null>(null);

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

    // Cleanup the timeout on component unmount
    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                <Tab label="Meal Plan" />
                <Tab label="Meal Management" />
            </Tabs>

            {activeTab === 0 && <MealPlanTab showToast={showToast} />}
            {activeTab === 1 && <MealManagementTab showToast={showToast} />}

            <Toast message={toast} />
        </div>
    );
};

export default App;