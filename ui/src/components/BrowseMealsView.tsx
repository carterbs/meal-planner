import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  IconButton,
  Stack,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Meal } from '../types';

interface BrowseMealsViewProps {
  meals: Meal[];
  mealFilter: string;
  onMealFilterChange: (val: string) => void;
  mealTypeFilter: string;
  onMealTypeFilterChange: (val: string) => void;
  onSelectMeal: (meal: Meal) => void;
  onDeleteMeal: (meal: Meal) => void;
  onBack: () => void;
}

const mealTypes = ['All', 'Breakfast', 'Lunch', 'Dinner'];

const BrowseMealsView: React.FC<BrowseMealsViewProps> = ({
  meals,
  mealFilter,
  onMealFilterChange,
  mealTypeFilter,
  onMealTypeFilterChange,
  onSelectMeal,
  onDeleteMeal,
  onBack,
}) => {
  const theme = useTheme();

  const filteredMeals = meals.filter((meal) =>
    meal.name.toLowerCase().includes(mealFilter.toLowerCase()),
  );

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Meal Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'mealType',
      headerName: 'Meal Type',
      width: 120,
      valueFormatter: (value: string) => {
        if (!value) return '';
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      },
    },
    {
      field: 'effort',
      headerName: 'Effort Level',
      width: 120,
      type: 'number',
    },
    {
      field: 'lastPlanned',
      headerName: 'Last Planned',
      width: 150,
      valueFormatter: (value: string | null | undefined) => {
        if (!value || value === '') return 'Never';
        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) return 'Never';
          return date.toLocaleDateString();
        } catch {
          return 'Never';
        }
      },
    },
    {
      field: 'hasRedMeat',
      headerName: 'Red Meat',
      width: 100,
      renderCell: (params) => (params.value ? '🥩' : '❌'),
    },
    {
      field: 'url',
      headerName: 'Recipe URL',
      width: 120,
      renderCell: (params) => {
        if (!params.value) return '';
        return (
          <Button
            variant="text"
            size="small"
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
          >
            Link
          </Button>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            const meal = meals.find((m) => m.id === params.id);
            if (meal) {
              onDeleteMeal(meal);
            }
          }}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Box
      sx={{
        py: 3,
        px: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton
          onClick={onBack}
          aria-label="back to main menu"
          sx={{
            color: '#6b8c5d',
            '&:hover': {
              backgroundColor: 'rgba(107, 140, 93, 0.1)',
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          sx={{
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            fontWeight: 600,
            color: '#3a3a3a',
          }}
        >
          Browse Meals
        </Typography>
      </Stack>

      {/* Full-width meals list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Available Meals
        </Typography>
        <Box sx={{ mb: 2 }}>
          <TextField
            label="Search Meals"
            variant="outlined"
            size="small"
            value={mealFilter}
            onChange={(e) => onMealFilterChange(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{
              sx: {
                borderRadius: 2,
                bgcolor: 'background.paper',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                },
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {mealTypes.map((type) => (
              <Button
                key={type}
                variant={mealTypeFilter === type ? 'contained' : 'outlined'}
                onClick={() => onMealTypeFilterChange(type)}
                size="small"
              >
                {type}
              </Button>
            ))}
          </Box>
        </Box>
        <Paper
          sx={{
            flexGrow: 1,
            width: '100%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            border: '1px solid #e0e4e0',
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '500px',
            backgroundColor: '#ffffff',
          }}
        >
          <DataGrid
            rows={filteredMeals}
            columns={columns}
            getRowId={(row) => row.id}
            initialState={{
              sorting: {
                sortModel: [{ field: 'name', sort: 'asc' }],
              },
            }}
            onRowClick={(params) => {
              const meal = meals.find((m) => m.id === params.id);
              if (meal) onSelectMeal(meal);
            }}
            rowSelection={false}
            disableRowSelectionOnClick
            hideFooter
            sx={{
              flexGrow: 1,
              '& .MuiDataGrid-row:hover': {
                cursor: 'pointer',
                backgroundColor: '#f7f4f2',
                boxShadow: 'none',
                transition: 'background-color 0.2s ease',
              },
              '& .MuiDataGrid-row.Mui-selected': {
                backgroundColor: '#c9e0c2',
              },
              '& .MuiDataGrid-row:nth-of-type(even)': {
                backgroundColor: '#fafafa',
              },
              '& .MuiDataGrid-cell': {
                textDecoration: 'none',
                borderBottom: '1px solid #e0e4e0',
                padding: '12px 16px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
              },
              '& .MuiDataGrid-row:focus, & .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
              '& .MuiDataGrid-row': {
                boxShadow: 'none',
              },
              border: 'none',
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#f7f4f2',
                borderBottom: '1px solid #e0e4e0',
                '& .MuiDataGrid-columnHeader': {
                  padding: '12px 16px',
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 600,
                  color: '#3a3a3a',
                  fontSize: '14px',
                },
              },
            }}
          />
        </Paper>
      </Box>
    </Box>
  );
};

export default BrowseMealsView; 