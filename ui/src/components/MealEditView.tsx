import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  TextField,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';

import StepsEditor from './StepsEditor';

import {
  createMealIngredient,
  updateMealIngredient,
  deleteMealIngredient,
  replaceAllSteps,
  updateMeal as updateMealApi,
} from '../api';

import type { GoMeal } from '@mealplanner/generated/dist/gateway/types.gen';

import { Meal, Ingredient, Step } from '@mealplanner/generated';
import { Timestamp } from '@bufbuild/protobuf';

interface MealEditViewProps {
  meal: Meal;
  onMealUpdated: (meal: Meal) => void;
  onBack: () => void;
  showToast: (message: string) => void;
}

const MealEditView: React.FC<MealEditViewProps> = ({
  meal,
  onMealUpdated,
  onBack,
  showToast,
}) => {
  const theme = useTheme();
  const [localMeal, setLocalMeal] = useState<Meal>(meal);
  const [editMode, setEditMode] = useState(false);
  const [editingIngredientIndex, setEditingIngredientIndex] =
    useState<number | null>(null);
  const [editedIngredient, setEditedIngredient] =
    useState<Ingredient | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocalMeal(meal);
  }, [meal]);

  /** Ingredient helpers */
  const addIngredient = () => {
    const newIngredient = new Ingredient({
      id: -Date.now(),
      mealId: localMeal.id,
      name: '',
      quantity: 0,
      unit: '',
    });
    const updatedMeal = new Meal({
      ...localMeal,
      ingredients: [...localMeal.ingredients, newIngredient],
    });
    setLocalMeal(updatedMeal);
    setEditingIngredientIndex(updatedMeal.ingredients.length - 1);
    setEditedIngredient(newIngredient);
  };

  const startEditing = (ingredient: Ingredient) => {
    const index = localMeal.ingredients.findIndex((i) => i.id === ingredient.id);
    if (index !== -1) {
      setEditingIngredientIndex(index);
      setEditedIngredient(new Ingredient(ingredient));
    }
  };

  const cancelIngredientEdit = () => {
    setEditingIngredientIndex(null);
    setEditedIngredient(null);
  };

  const handleIngredientChange = (
    field: keyof Ingredient,
    value: string | number,
  ) => {
    if (!editedIngredient) return;
    setEditedIngredient(new Ingredient({
      ...editedIngredient,
      [field]: value,
    }));
  };

  const saveIngredient = () => {
    if (editingIngredientIndex === null || !editedIngredient) return;

    const isNew = editedIngredient.id < 0;
    const ingredientForApi = {
      id: isNew ? 0 : editedIngredient.id,
      mealId: localMeal.id,
      name: editedIngredient.name,
      quantity: editedIngredient.quantity,
      unit: editedIngredient.unit,
    };

    const apiCall = isNew
      ? createMealIngredient(localMeal.id, ingredientForApi)
      : updateMealIngredient(localMeal.id, editedIngredient.id, ingredientForApi);

    apiCall
      .then((updated) => {
        setLocalMeal(updated);
        onMealUpdated(updated);
        setEditingIngredientIndex(null);
        setEditedIngredient(null);
        showToast(isNew ? 'Ingredient added successfully' : 'Ingredient updated successfully');
      })
      .catch((err) => {
        console.error(err);
        showToast('Error saving ingredient');
      });
  };

  const deleteIngredient = (ingredientId: number) => {
    const isNew = ingredientId < 0;

    if (isNew) {
      const updatedIngredients = localMeal.ingredients.filter((i) => i.id !== ingredientId);
      const updatedMeal = new Meal({ ...localMeal, ingredients: updatedIngredients });
      setLocalMeal(updatedMeal);
      onMealUpdated(updatedMeal);
      showToast('Ingredient removed');
      return;
    }

    deleteMealIngredient(localMeal.id, ingredientId)
      .then((updated) => {
        setLocalMeal(updated);
        onMealUpdated(updated);
        showToast('Ingredient deleted successfully');
      })
      .catch((err) => {
        console.error(err);
        showToast('Error deleting ingredient');
      });
  };

  /** Steps helper */
  const handleSaveSteps = async (mealId: number, steps: Step[]) => {
    try {
      setLoading(true);
      await replaceAllSteps(mealId, steps);
      const updatedMeal = new Meal({ ...localMeal, steps });
      setLocalMeal(updatedMeal);
      onMealUpdated(updatedMeal);
      showToast('Recipe steps saved successfully');
    } catch (error) {
      console.error(error);
      showToast('Error saving steps');
    } finally {
      setLoading(false);
    }
  };

  /** Persist overall meal */
  const handleUpdateMeal = async (updatedMeal: Meal) => {
    if (!updatedMeal.id) return;
    try {
      setLoading(true);
      // Convert UI Meal to GoMeal, handling timestamp conversion
      const { lastPlanned, ...mealDataWithoutTimestamp } = updatedMeal;
      const mealData: GoMeal = {
        ...mealDataWithoutTimestamp,
        // Convert protobuf Timestamp to RFC3339 string if it exists
        lastPlanned: lastPlanned ? lastPlanned.toDate().toISOString() : undefined
      };

      const result = await updateMealApi(updatedMeal.id, mealData);
      setLocalMeal(result);
      onMealUpdated(result);
      showToast('Meal updated successfully');
    } catch (error) {
      console.error(error);
      showToast('Error updating meal');
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = () => {
    if (editMode) {
      setEditingIngredientIndex(null);
      setEditedIngredient(null);
      handleUpdateMeal(localMeal).then(onBack);
    }
    setEditMode(!editMode);
  };

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
          aria-label="back to meals list"
          sx={{
            color: '#6b8c5d',
            '&:hover': { backgroundColor: 'rgba(107, 140, 93, 0.1)' },
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
          {localMeal.name}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant={editMode ? 'outlined' : 'contained'}
          color={editMode ? 'secondary' : 'primary'}
          onClick={toggleEditMode}
          startIcon={editMode ? null : <EditIcon />}
        >
          {editMode ? 'Done' : 'Edit Recipe'}
        </Button>
      </Stack>

      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          borderColor: '#e0e4e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          flexGrow: 1,
          backgroundColor: '#ffffff',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Meal type selector and Last Planned date */}
          {editMode && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="meal-type-edit-label">Meal Type</InputLabel>
                    <Select
                      labelId="meal-type-edit-label"
                      id="meal-type-edit-select"
                      value={localMeal.mealType}
                      label="Meal Type"
                      onChange={(e) =>
                        setLocalMeal(new Meal({ ...localMeal, mealType: e.target.value }))
                      }
                    >
                      <MenuItem value="breakfast">Breakfast</MenuItem>
                      <MenuItem value="lunch">Lunch</MenuItem>
                      <MenuItem value="dinner">Dinner</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Last Planned"
                    type="date"
                    size="small"
                    fullWidth
                    value={
                      localMeal.lastPlanned
                        ? localMeal.lastPlanned.toDate().toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) => {
                      const dateValue = e.target.value;
                      setLocalMeal(new Meal({
                        ...localMeal,
                        lastPlanned: dateValue
                          ? Timestamp.fromDate(new Date(dateValue + 'T00:00:00.000Z'))
                          : undefined,
                      }));
                    }}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Meta chips */}
          <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                bgcolor: alpha(theme.palette.info.main, 0.08),
                color: theme.palette.info.main,
                py: 0.5,
                px: 1.5,
                borderRadius: 4,
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              {localMeal.mealType.charAt(0).toUpperCase() + localMeal.mealType.slice(1)}
            </Box>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.main,
                py: 0.5,
                px: 1.5,
                borderRadius: 4,
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              Effort Level: {localMeal.effort}
            </Box>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                bgcolor: localMeal.hasRedMeat
                  ? alpha(theme.palette.secondary.main, 0.08)
                  : alpha(theme.palette.success.main, 0.08),
                color: localMeal.hasRedMeat
                  ? theme.palette.secondary.main
                  : theme.palette.success.main,
                py: 0.5,
                px: 1.5,
                borderRadius: 4,
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              {localMeal.hasRedMeat ? '🥩 Red Meat' : '🥗 No Red Meat'}
            </Box>
          </Stack>

          {localMeal.url && (
            <Button
              variant="contained"
              color="primary"
              href={localMeal.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mb: 3 }}
            >
              View Recipe Online
            </Button>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Ingredients section */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Ingredients:
            </Typography>
            {editMode && (
              <Button variant="outlined" onClick={addIngredient} startIcon={<AddIcon />} size="small">
                Add Ingredient
              </Button>
            )}
          </Box>

          {localMeal.ingredients.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2, mb: 4 }}>
              {localMeal.ingredients.map((ing, index) => (
                <Box
                  key={ing.id || index}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1.5,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.1),
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.05)}`,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                      boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.08)}`,
                    },
                  }}
                >
                  {editMode && editingIngredientIndex === index ? (
                    <Box sx={{ width: '100%' }}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <TextField
                            label="name"
                            size="small"
                            fullWidth
                            value={editedIngredient?.name || ''}
                            onChange={(e) => handleIngredientChange('name', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={3}>
                          <TextField
                            label="quantity"
                            size="small"
                            type="number"
                            fullWidth
                            value={editedIngredient?.quantity || 0}
                            onChange={(e) => handleIngredientChange('quantity', parseFloat(e.target.value))}
                          />
                        </Grid>
                        <Grid item xs={3}>
                          <TextField
                            label="unit"
                            size="small"
                            fullWidth
                            value={editedIngredient?.unit || ''}
                            onChange={(e) => handleIngredientChange('unit', e.target.value)}
                          />
                        </Grid>
                      </Grid>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
                        <Button variant="contained" color="primary" onClick={saveIngredient} sx={{ borderRadius: 6 }}>
                          Save
                        </Button>
                        <Button variant="outlined" onClick={cancelIngredientEdit} sx={{ borderRadius: 6 }}>
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <Typography fontWeight={500}>{`${ing.quantity ? ing.quantity + ' ' : ''}${ing.unit ? ing.unit + ' ' : ''}${ing.name}`.trim()}</Typography>
                      {editMode && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button variant="outlined" onClick={() => startEditing(ing)} size="small" sx={{ borderRadius: 6 }}>
                            Edit
                          </Button>
                          <Button variant="outlined" color="error" onClick={() => deleteIngredient(ing.id)} size="small" sx={{ borderRadius: 6 }}>
                            Delete
                          </Button>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4, fontStyle: 'italic' }}>
              No ingredients added yet.
            </Typography>
          )}

          {/* Steps */}
          {(localMeal.steps && localMeal.steps.length > 0) || editMode ? (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recipe Steps
              </Typography>
              <StepsEditor
                steps={localMeal.steps || []}
                onChange={(steps) => editMode && setLocalMeal(new Meal({ ...localMeal, steps }))}
                readOnly={!editMode}
              />
              {editMode && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleSaveSteps(localMeal.id, localMeal.steps || [])}
                    disabled={loading}
                  >
                    Save Steps
                  </Button>
                </Box>
              )}
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
};

export default MealEditView; 