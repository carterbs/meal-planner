import React from "react";

interface ToastProps {
    message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
    if (!message) return null;

    return (
        <div
            style={{
                position: "fixed",
                bottom: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                color: "white",
                padding: "10px 20px",
                borderRadius: "5px",
                zIndex: 1000,
            }}
        >
            {message}
        </div>
    );
}; 