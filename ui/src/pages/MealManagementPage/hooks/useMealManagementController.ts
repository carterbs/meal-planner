import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Meal } from '@mealplanner/generated';
import { getMeals, deleteMeal as deleteMealApi } from '../../../api/mealsApi';

export type MealManagementView = 'browse' | 'edit' | 'add';

export interface MealFilters {
  text: string;
  type: 'All' | 'Breakfast' | 'Lunch' | 'Dinner';
}

export interface UseMealManagementControllerReturn {
  meals: Meal[];
  selectedMeal: Meal | null;
  filters: MealFilters;
  currentView: MealManagementView;
  loading: boolean;
  error: string | null;

  // actions
  fetchMeals: () => Promise<void>;
  selectMeal: (meal: Meal) => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<MealFilters>) => void;
  deleteMeal: (meal: Meal) => Promise<void>;
  onMealUpdated: (meal: Meal) => void;
  goToBrowse: () => void;
  goToEdit: () => void;
  goToAdd: () => void;
}

export default function useMealManagementController(): UseMealManagementControllerReturn {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [filters, setFiltersState] = useState<MealFilters>({
    text: '',
    type: 'All',
  });
  const [currentView, setCurrentView] = useState<MealManagementView>('browse');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const fetchMeals = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const type =
        filters.type !== 'All' ? filters.type.toLowerCase() : undefined;
      const data = await getMeals(type);
      if (requestId === activeRequestIdRef.current) {
        setMeals(data);
      }
    } catch (err) {
      console.error(err);
      if (requestId === activeRequestIdRef.current) {
        setError('Error fetching meals');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filters.type]);

  // initial load and when type changes
  useEffect(() => {
    void fetchMeals();
  }, [fetchMeals]);

  const selectMeal = useCallback((meal: Meal) => {
    setSelectedMeal(meal);
    setCurrentView('edit');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMeal(null);
  }, []);

  const setFilters = useCallback((partial: Partial<MealFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const deleteMeal = useCallback(
    async (meal: Meal) => {
      await deleteMealApi(meal.id);
      setMeals((prev) => prev.filter((m) => m.id !== meal.id));
      if (selectedMeal?.id === meal.id) {
        setSelectedMeal(null);
      }
    },
    [selectedMeal],
  );

  const onMealUpdated = useCallback((updated: Meal) => {
    setMeals((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  const goToBrowse = useCallback(() => {
    setCurrentView('browse');
    // refetch on transition to browse to ensure latest data (e.g., lastPlanned)
    void fetchMeals();
  }, [fetchMeals]);

  const goToEdit = useCallback(() => setCurrentView('edit'), []);
  const goToAdd = useCallback(() => setCurrentView('add'), []);

  return useMemo(
    () => ({
      meals,
      selectedMeal,
      filters,
      currentView,
      loading,
      error,
      fetchMeals,
      selectMeal,
      clearSelection,
      setFilters,
      deleteMeal,
      onMealUpdated,
      goToBrowse,
      goToEdit,
      goToAdd,
    }),
    [
      meals,
      selectedMeal,
      filters,
      currentView,
      loading,
      error,
      fetchMeals,
      selectMeal,
      clearSelection,
      setFilters,
      deleteMeal,
      onMealUpdated,
      goToBrowse,
      goToEdit,
      goToAdd,
    ],
  );
}
