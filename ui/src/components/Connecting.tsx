import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ConnectingProps {
  services?: Record<string, boolean>;
}

const Connecting: React.FC<ConnectingProps> = ({ services }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="h6">Connecting to server...</Typography>
      {services && (
        <Box>
          {Object.entries(services).map(([name, ok]) => (
            <Typography
              key={name}
              color={ok ? 'success.main' : 'error.main'}
              variant="body2"
            >
              {name}: {ok ? 'healthy' : 'unhealthy'}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default Connecting;
