import React from 'react';
import { Meal } from '@mealplanner/generated';
import MealEditView from '../../../components/MealEditView';

interface RecipeEditorPanelProps {
  meal: Meal;
  onSave: (meal: Meal) => void;
  onBack: () => void;
  showToast: (message: string) => void;
}

const RecipeEditorPanel: React.FC<RecipeEditorPanelProps> = ({
  meal,
  onSave,
  onBack,
  showToast,
}) => {
  return (
    <MealEditView
      meal={meal}
      onMealUpdated={onSave}
      onBack={onBack}
      showToast={showToast}
    />
  );
};

export default RecipeEditorPanel;
