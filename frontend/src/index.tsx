import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

// Add Google Fonts
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap';
document.head.appendChild(fontLink);

try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
        throw new Error("Root element not found");
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <App />
            </ThemeProvider>
        </React.StrictMode>
    );
} catch (error) {
    console.error(error instanceof Error ? error.message : "Failed to initialize app");
} 