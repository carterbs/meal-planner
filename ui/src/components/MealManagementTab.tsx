import React, { useEffect, useState } from 'react';
import { useCallback } from 'react';
import { Box, Fade } from '@mui/material';
import { Meal } from '../types';
import MealLibraryMainView from './MealLibraryMainView';
import BrowseMealsView from './BrowseMealsView';
import MealEditView from './MealEditView';
import AddRecipeForm from '../AddRecipeForm';

import { getMeals, deleteMeal as deleteMealApi } from '../api';

interface MealManagementTabProps {
  showToast: (message: string) => void;
  onClose?: () => void;
}

export const MealManagementTab: React.FC<MealManagementTabProps> = ({
  showToast,
  onClose,
}) => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [mealFilter, setMealFilter] = useState<string>('');
  const [mealTypeFilter, setMealTypeFilter] = useState<string>('All');
  const [currentView, setCurrentView] = useState<'main' | 'browse' | 'add'>(
    'main',
  );

  // Fetch meals whenever the meal type filter changes
  const fetchMeals = useCallback(async () => {
    const type = mealTypeFilter !== 'All' ? mealTypeFilter.toLowerCase() : undefined;
    try {
      const data = (await (getMeals(type) as unknown as Promise<Meal[]> | Meal[])) as Meal[];
      setMeals(data);
    } catch (err) {
      console.error(err);
      showToast('Error fetching meals');
    }
  }, [mealTypeFilter, showToast]);

  useEffect(() => {
    void fetchMeals();
  }, [fetchMeals]);

  // Refetch meals when entering the browse view to ensure latest data (e.g., lastPlanned updates)
  useEffect(() => {
    if (currentView === 'browse') {
      void fetchMeals();
    }
  }, [currentView, fetchMeals]);

  /** Callback after creating a new recipe */
  const handleRecipeAdded = () => {
    void fetchMeals();
    showToast('New recipe added successfully!');
    setCurrentView('main');
  };

  /** Delete a meal and refresh list */
  const deleteMeal = (meal: Meal) => {
    deleteMealApi(meal.id!)
      .then(() => {
        setMeals((prev) => prev.filter((m) => m.id !== meal.id));
        showToast('Meal deleted successfully');
        if (selectedMeal?.id === meal.id) setSelectedMeal(null);
      })
      .catch((err) => {
        console.error(err);
        showToast('Error deleting meal');
      });
  };

  /** Update a single meal inside list */
  const handleMealUpdated = (updated: Meal) => {
    setMeals((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  return (
    <Box
      data-testid="meal-management-tab"
      sx={{ backgroundColor: '#F7F5F2', minHeight: '100vh', color: '#3a3a3a' }}
    >
      {currentView === 'main' && (
        <MealLibraryMainView
          onBrowse={() => setCurrentView('browse')}
          onAdd={() => setCurrentView('add')}
          onClose={onClose}
        />
      )}

      {currentView === 'browse' && !selectedMeal && (
        <Fade in>
          <Box sx={{ height: '100%' }}>
            <BrowseMealsView
              meals={meals}
              mealFilter={mealFilter}
              onMealFilterChange={setMealFilter}
              mealTypeFilter={mealTypeFilter}
              onMealTypeFilterChange={setMealTypeFilter}
              onSelectMeal={(meal) => setSelectedMeal(meal)}
              onDeleteMeal={deleteMeal}
              onBack={() => setCurrentView('main')}
            />
          </Box>
        </Fade>
      )}

      {selectedMeal && (
        <Fade in>
          <Box sx={{ height: '100%' }}>
            <MealEditView
              meal={selectedMeal}
              onMealUpdated={(m) => {
                handleMealUpdated(m);
                setSelectedMeal(m);
                // Re-fetch full list to capture any updates like lastPlanned
                void fetchMeals();
              }}
              onBack={() => {
                setSelectedMeal(null);
                // Re-fetch meals when leaving edit view
                void fetchMeals();
              }}
              showToast={showToast}
            />
          </Box>
        </Fade>
      )}

      {currentView === 'add' && (
        <Fade in>
          <Box sx={{ py: 3, px: 3 }}>
            <AddRecipeForm onRecipeAdded={handleRecipeAdded} />
          </Box>
        </Fade>
      )}
    </Box>
  );
}; 