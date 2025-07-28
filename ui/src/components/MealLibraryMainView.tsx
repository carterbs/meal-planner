import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Stack,
  IconButton,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface MealLibraryMainViewProps {
  onBrowse: () => void;
  onAdd: () => void;
  onClose?: () => void;
}

const MealLibraryMainView: React.FC<MealLibraryMainViewProps> = ({
  onBrowse,
  onAdd,
  onClose,
}) => {
  return (
    <Box sx={{ py: 4, px: 3 }} data-testid="meal-management-tab">
      {onClose && (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <IconButton
            onClick={onClose}
            aria-label="close meal library"
            sx={{
              color: '#6b8c5d',
              '&:hover': {
                backgroundColor: 'rgba(107, 140, 93, 0.1)',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
        </Stack>
      )}
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          fontWeight: 600,
          mb: 4,
          color: '#3a3a3a',
          fontSize: '2rem',
        }}
      >
        Meal Library
      </Typography>
      <Grid container spacing={4} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '200px',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              overflow: 'hidden',
              transition: 'all 0.2s ease',
              border: '1px solid #e0e4e0',
              backgroundColor: '#ffffff',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              },
            }}
          >
            <CardActionArea
              onClick={onBrowse}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                alignItems: 'center',
                padding: 3,
                backgroundColor: '#ffffff',
              }}
            >
              <Box
                sx={{
                  bgcolor: '#c9e0c2',
                  borderRadius: '50%',
                  p: 2,
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MenuBookIcon sx={{ fontSize: 48, color: '#6b8c5d' }} />
              </Box>
              <Typography
                variant="h6"
                component="div"
                gutterBottom
                sx={{
                  fontFamily:
                    '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                  fontWeight: 600,
                  color: '#3a3a3a',
                  mb: 1,
                }}
              >
                Browse Meals
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                align="center"
                sx={{ fontSize: '14px', maxWidth: '80%', lineHeight: 1.5 }}
              >
                View, search, and manage your saved recipes
              </Typography>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '200px',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              overflow: 'hidden',
              transition: 'all 0.2s ease',
              border: '1px solid #e0e4e0',
              backgroundColor: '#ffffff',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              },
            }}
          >
            <CardActionArea
              onClick={onAdd}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                alignItems: 'center',
                padding: 3,
                backgroundColor: '#ffffff',
              }}
            >
              <Box
                sx={{
                  bgcolor: '#FFB347',
                  borderRadius: '50%',
                  p: 2,
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AddIcon sx={{ fontSize: 48, color: '#ffffff' }} />
              </Box>
              <Typography
                variant="h6"
                component="div"
                gutterBottom
                sx={{
                  fontFamily:
                    '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                  fontWeight: 600,
                  color: '#3a3a3a',
                  mb: 1,
                }}
              >
                Add New Recipe
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                align="center"
                sx={{ fontSize: '14px', maxWidth: '80%', lineHeight: 1.5 }}
              >
                Create a new recipe to add to your meal library
              </Typography>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MealLibraryMainView; 