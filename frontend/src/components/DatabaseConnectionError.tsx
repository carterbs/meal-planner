import React from 'react';
import { Box, Typography, Button, Paper, Alert, AlertTitle } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface DatabaseConnectionErrorProps {
  onRetry: () => void;
}

export const DatabaseConnectionError: React.FC<DatabaseConnectionErrorProps> = ({ onRetry }) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        padding: 3
      }}
    >
      <Paper 
        elevation={3} 
        sx={{ 
          padding: 4, 
          maxWidth: 600, 
          width: '100%',
          borderRadius: 2,
          border: '1px solid #f5c2c7'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <ErrorOutlineIcon color="error" sx={{ fontSize: 60 }} />
        </Box>
        
        <Typography variant="h5" component="h1" gutterBottom color="error" align="center">
          Database Connection Error
        </Typography>
        
        <Alert severity="error" sx={{ my: 2 }}>
          <AlertTitle>Unable to connect to the database</AlertTitle>
          The application is unable to connect to the database. This usually happens when the Docker container
          for the database is not running.
        </Alert>
        
        <Box sx={{ my: 3 }}>
          <Typography variant="body1" paragraph>
            <strong>Troubleshooting steps:</strong>
          </Typography>
          <ol>
            <li>
              <Typography variant="body2" paragraph>
                Make sure Docker is running on your system
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                Check if the PostgreSQL database container is started:
                <Box component="pre" sx={{ 
                  backgroundColor: '#f5f5f5', 
                  p: 1, 
                  borderRadius: 1,
                  mt: 1,
                  fontSize: '0.875rem',
                  overflowX: 'auto'
                }}>
                  $ docker ps | grep postgres
                </Box>
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                If not running, start it with:
                <Box component="pre" sx={{ 
                  backgroundColor: '#f5f5f5', 
                  p: 1, 
                  borderRadius: 1,
                  mt: 1,
                  fontSize: '0.875rem',
                  overflowX: 'auto'
                }}>
                  $ docker-compose up -d
                </Box>
              </Typography>
            </li>
          </ol>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={onRetry}
            size="large"
          >
            Retry Connection
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};