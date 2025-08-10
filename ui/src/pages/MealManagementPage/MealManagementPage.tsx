import React from 'react';
import { Box } from '@mui/material';
import useMealManagementController from './hooks/useMealManagementController';
import Header from './components/Header';
import LibraryPanel from './components/LibraryPanel';
import RecipeEditorPanel from './components/RecipeEditorPanel';
import AddRecipePanel from './components/AddRecipePanel';
import { Meal } from '@mealplanner/generated';

interface MealManagementPageProps {
  showToast: (message: string) => void;
  onClose?: () => void;
}

const MealManagementPage: React.FC<MealManagementPageProps> = ({
  showToast,
  onClose,
}) => {
  const controller = useMealManagementController();
  const {
    meals,
    selectedMeal,
    filters,
    currentView,
    setFilters,
    selectMeal,
    deleteMeal,
    onMealUpdated,
    goToBrowse,
    goToAdd,
    clearSelection,
  } = controller;

  return (
    <Box
      sx={{
        backgroundColor: '#F7F5F2',
        minHeight: '100vh',
        color: '#3a3a3a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!selectedMeal && (
        <Header
          onBack={currentView !== 'browse' ? goToBrowse : undefined}
          onClose={onClose}
          onAdd={() => goToAdd()}
        />
      )}

      {!selectedMeal && currentView === 'browse' && (
        <LibraryPanel
          meals={meals}
          text={filters.text}
          type={filters.type as any}
          onTextChange={(text) => setFilters({ text })}
          onTypeChange={(type) => setFilters({ type: type as any })}
          onSelectMeal={(meal: Meal) => selectMeal(meal)}
          onDeleteMeal={deleteMeal}
        />
      )}

      {selectedMeal && (
        <RecipeEditorPanel
          meal={selectedMeal}
          onSave={(m) => {
            onMealUpdated(m);
          }}
          onBack={() => {
            clearSelection();
            goToBrowse();
          }}
          showToast={showToast}
        />
      )}

      {!selectedMeal && currentView === 'add' && (
        <AddRecipePanel
          onSuccess={() => {
            goToBrowse();
          }}
        />
      )}
    </Box>
  );
};

export default MealManagementPage;
