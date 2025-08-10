import React, { useMemo } from 'react';
import { Box, Paper } from '@mui/material';
import { Meal } from '@mealplanner/generated';
import Toolbar from './Toolbar';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

interface LibraryPanelProps {
  meals: Meal[];
  text: string;
  type: 'All' | 'Breakfast' | 'Lunch' | 'Dinner';
  onTextChange: (text: string) => void;
  onTypeChange: (type: 'All' | 'Breakfast' | 'Lunch' | 'Dinner') => void;
  onSelectMeal: (meal: Meal) => void;
  onDeleteMeal: (meal: Meal) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({
  meals,
  text,
  type,
  onTextChange,
  onTypeChange,
  onSelectMeal,
  onDeleteMeal,
}) => {
  const filteredMeals = useMemo(
    () =>
      meals.filter((m) => m.name.toLowerCase().includes(text.toLowerCase())),
    [meals, text],
  );

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Meal Name', flex: 1, minWidth: 200 },
    {
      field: 'mealType',
      headerName: 'Meal Type',
      width: 120,
      valueFormatter: (value: string) =>
        value ? value.charAt(0).toUpperCase() + value.slice(1) : '',
    },
    { field: 'effort', headerName: 'Effort', width: 100, type: 'number' },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params) => {
        const meal = meals.find((m) => m.id === params.id);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (meal) onDeleteMeal(meal);
            }}
          >
            Delete
          </button>
        );
      },
    },
  ];

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}
    >
      <Toolbar
        total={filteredMeals.length}
        text={text}
        type={type}
        onTextChange={onTextChange}
        onTypeChange={onTypeChange}
      />
      <Paper sx={{ flex: 1, overflow: 'hidden' }}>
        <DataGrid
          rows={filteredMeals}
          columns={columns}
          getRowId={(row) => row.id}
          hideFooter
          onRowClick={(params) => {
            const meal = meals.find((m) => m.id === params.id);
            if (meal) onSelectMeal(meal);
          }}
        />
      </Paper>
    </Box>
  );
};

export default LibraryPanel;
