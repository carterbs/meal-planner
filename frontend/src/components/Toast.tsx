import React from "react";
import { Box, Paper, Typography, Fade, useTheme } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface ToastProps {
    message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
    const theme = useTheme();

    if (!message) return null;

    return (
        <Fade in={Boolean(message)}>
            <Paper
                elevation={4}
                sx={{
                    position: "fixed",
                    bottom: "24px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: theme.palette.primary.main,
                    color: "white",
                    padding: "12px 24px",
                    borderRadius: "12px",
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    minWidth: '200px',
                    maxWidth: '90%',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
            >
                <CheckCircleIcon sx={{ fontSize: 20 }} />
                <Typography variant="body2" fontWeight={500}>
                    {message}
                </Typography>
            </Paper>
        </Fade>
    );
}; 