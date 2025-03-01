import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Alert, AlertTitle, useTheme, alpha, Fade, CircularProgress } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface DatabaseConnectionErrorProps {
  onRetry: () => Promise<void>;
}

export const DatabaseConnectionError: React.FC<DatabaseConnectionErrorProps> = ({ onRetry }) => {
  const theme = useTheme();
  const [isRetrying, setIsRetrying] = useState(false);

  // Minimum duration to show the loading state (in milliseconds)
  const MIN_LOADING_DURATION = 1000;

  const handleRetry = async () => {
    if (isRetrying) return; // Prevent multiple clicks

    setIsRetrying(true);
    const startTime = Date.now();

    try {
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      // Calculate how much time has passed
      const elapsedTime = Date.now() - startTime;

      // If the operation was too fast, wait a bit longer to avoid jittery UI
      if (elapsedTime < MIN_LOADING_DURATION) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_DURATION - elapsedTime));
      }

      setIsRetrying(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: 3,
        backgroundImage: `linear-gradient(120deg, ${alpha(theme.palette.error.light, 0.05)}, ${alpha(theme.palette.background.default, 1)})`,
      }}
    >
      <Fade in={true} timeout={800}>
        <Paper
          elevation={0}
          sx={{
            padding: { xs: 3, md: 5 },
            maxWidth: 650,
            width: '100%',
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            boxShadow: `0 10px 40px ${alpha(theme.palette.error.main, 0.1)}`,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '6px',
              bgcolor: theme.palette.error.main
            }}
          />

          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <SyncProblemIcon
              sx={{
                fontSize: 80,
                color: theme.palette.error.main,
                filter: 'drop-shadow(0 4px 8px rgba(211, 47, 47, 0.2))'
              }}
            />
          </Box>

          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            color="error"
            align="center"
            sx={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 700,
              mb: 2
            }}
          >
            Database Connection Error
          </Typography>

          <Alert
            severity="error"
            variant="filled"
            sx={{
              my: 3,
              boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.2)}`,
              '& .MuiAlert-icon': {
                fontSize: '1.5rem'
              }
            }}
          >
            <AlertTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>Unable to connect to the database</AlertTitle>
            The application is unable to connect to the database. This usually happens when the Docker container
            for the database is not running.
          </Alert>

          <Box
            sx={{
              my: 4,
              p: 3,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
            }}
          >
            <Typography
              variant="h6"
              paragraph
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: theme.palette.primary.dark,
                fontWeight: 600,
              }}
            >
              <HelpOutlineIcon /> Troubleshooting steps:
            </Typography>
            <ol style={{ paddingLeft: '1.5rem' }}>
              <li>
                <Typography variant="body1" paragraph fontWeight={500}>
                  Make sure Docker is running on your system
                </Typography>
              </li>
              <li>
                <Typography variant="body1" paragraph fontWeight={500}>
                  Check if the PostgreSQL database container is started:
                  <Box component="pre" sx={{
                    backgroundColor: theme.palette.background.paper,
                    p: 2,
                    borderRadius: 1,
                    mt: 1,
                    fontSize: '0.875rem',
                    overflowX: 'auto',
                    border: `1px solid ${theme.palette.divider}`,
                    fontFamily: 'monospace'
                  }}>
                    $ docker ps | grep postgres
                  </Box>
                </Typography>
              </li>
              <li>
                <Typography variant="body1" paragraph fontWeight={500}>
                  If not running, start it with:
                  <Box component="pre" sx={{
                    backgroundColor: theme.palette.background.paper,
                    p: 2,
                    borderRadius: 1,
                    mt: 1,
                    fontSize: '0.875rem',
                    overflowX: 'auto',
                    border: `1px solid ${theme.palette.divider}`,
                    fontFamily: 'monospace'
                  }}>
                    $ docker-compose up -d
                  </Box>
                </Typography>
              </li>
            </ol>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRetry}
              size="large"
              disabled={isRetrying}
              startIcon={isRetrying ? <CircularProgress size={20} color="inherit" /> : <ReplayIcon />}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                borderRadius: 2,
                boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.25)}`,
                '&:hover': {
                  boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.35)}`,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s'
                }
              }}
            >
              {isRetrying ? 'Attempting to Reconnect...' : 'Retry Connection'}
            </Button>
          </Box>
        </Paper>
      </Fade>
    </Box>
  );
};