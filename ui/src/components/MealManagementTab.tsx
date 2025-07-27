import React, { useEffect, useState } from 'react';
import { Ingredient, Meal, Step } from '../types';
import {
  getMeals,
  updateMealIngredient,
  createMealIngredient,
  deleteMealIngredient,
  deleteMeal as deleteMealApi,
  replaceAllSteps,
  updateMeal as updateMealApi,
} from '../api';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Button,
  TextField,
  CardActionArea,
  Stack,
  Divider,
  IconButton,
  Fade,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { format } from 'date-fns';
import AddRecipeForm from '../AddRecipeForm';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import StepsEditor from './StepsEditor';

interface MealManagementTabProps {
  showToast: (message: string) => void;
  onClose?: () => void;
}

const mealTypes = ['All', 'Breakfast', 'Lunch', 'Dinner'];

export const MealManagementTab: React.FC<MealManagementTabProps> = ({
  showToast,
  onClose,
}) => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<
    number | null
  >(null);
  const [editedIngredient, setEditedIngredient] = useState<Ingredient | null>(
    null,
  );
  const [mealFilter, setMealFilter] = useState<string>('');
  const [mealTypeFilter, setMealTypeFilter] = useState<string>('All');
  const [currentView, setCurrentView] = useState<'main' | 'browse' | 'add'>(
    'main',
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>(
    'success',
  );
  const [editMode, setEditMode] = useState<boolean>(false);
  const theme = useTheme();

  // Column definitions for the DataGrid
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
      valueFormatter: (value: string | null) => {
        if (!value) return 'Never';
        const date = new Date(value);
        return format(date, 'MM-dd-yyyy');
      },
    },
    {
      field: 'hasRedMeat',
      headerName: 'Red Meat',
      width: 100,
      renderCell: (params) => {
        return params.value ? '🥩' : '❌';
      },
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
              setSelectedMeal(meal);
              deleteMeal(meal);
            }
          }}
        >
          Delete
        </Button>
      ),
    },
  ];

  // Handle adding a new ingredient to a meal
  const addIngredient = () => {
    if (!selectedMeal) return;

    // Create a default new ingredient with a negative temporary ID to indicate it's new
    const newIngredient: Ingredient = {
      id: -Date.now(), // Negative temporary ID for new ingredients
      mealId: selectedMeal.id || 0,
      name: '',
      quantity: 0,
      unit: '',
    };

    // Create updated meal with the new ingredient
    const updatedMeal = {
      ...selectedMeal,
      ingredients: [...selectedMeal.ingredients, newIngredient],
    };

    // Update the selected meal directly
    setSelectedMeal(updatedMeal);
    setEditingIngredientIndex(updatedMeal.ingredients.length - 1);
    setEditedIngredient(newIngredient);

    // Update the meals array with the new meal data
    setMeals((prev) =>
      prev.map((m) => (m.id === selectedMeal.id ? updatedMeal : m)),
    );
  };

  // Start editing an ingredient
  const startEditing = (ingredient: Ingredient) => {
    if (!selectedMeal) return;
    const index = selectedMeal.ingredients.findIndex(
      (i) => i.id === ingredient.id,
    );
    if (index !== -1) {
      setEditingIngredientIndex(index);
      setEditedIngredient({ ...ingredient });
    }
  };

  // Cancel ingredient editing
  const cancelIngredientEdit = () => {
    setEditingIngredientIndex(null);
    setEditedIngredient(null);
  };

  // Save edited ingredient
  const saveIngredient = () => {
    if (!selectedMeal || editingIngredientIndex === null || !editedIngredient)
      return;

    // Check if this is a new ingredient (negative ID)
    const isNewIngredient = editedIngredient.id! < 0;

    // Create the ingredient data for the API using the MainIngredientResponse format
    const ingredientForApi = {
      id: isNewIngredient ? 0 : editedIngredient.id!,
      mealId: selectedMeal.id!,
      name: editedIngredient.name,
      quantity: editedIngredient.quantity,
      unit: editedIngredient.unit,
    };

    // Use different endpoints for creating vs updating ingredients
    const apiCall = isNewIngredient
      ? createMealIngredient(selectedMeal.id!, ingredientForApi)
      : updateMealIngredient(
          selectedMeal.id!,
          editedIngredient.id!,
          ingredientForApi,
        );

    // Save to backend
    apiCall
      .then((updatedMeal) => {
        // Update with the meal returned from backend
        setSelectedMeal(updatedMeal);
        setMeals((prev) =>
          prev.map((m) => (m.id === selectedMeal.id ? updatedMeal : m)),
        );

        setEditingIngredientIndex(null);
        setEditedIngredient(null);
        showToast(
          isNewIngredient
            ? 'Ingredient added successfully'
            : 'Ingredient updated successfully',
        );
      })
      .catch((err) => {
        console.error('Error saving ingredient:', err);
        showToast('Error saving ingredient');
      });
  };

  // Delete an ingredient
  const deleteIngredient = (ingredientId: number) => {
    if (!selectedMeal) return;

    // Check if this is a new ingredient (negative ID) that hasn't been saved yet
    const isNewIngredient = ingredientId < 0;

    if (isNewIngredient) {
      // For new ingredients, just remove from UI without API call
      const updatedIngredients = selectedMeal.ingredients.filter(
        (i) => i.id !== ingredientId,
      );
      const updatedMeal = {
        ...selectedMeal,
        ingredients: updatedIngredients,
      };

      setSelectedMeal(updatedMeal);
      setMeals((prev) =>
        prev.map((m) => (m.id === selectedMeal.id ? updatedMeal : m)),
      );
      showToast('Ingredient removed');
      return;
    }

    // For existing ingredients, delete from backend
    deleteMealIngredient(selectedMeal.id!, ingredientId)
      .then((updatedMeal) => {
        // Update with the meal returned from backend
        setSelectedMeal(updatedMeal);
        setMeals((prev) =>
          prev.map((m) => (m.id === selectedMeal.id ? updatedMeal : m)),
        );

        showToast('Ingredient deleted successfully');
      })
      .catch((err) => {
        console.error('Error deleting ingredient:', err);
        showToast('Error deleting ingredient');
      });
  };

  // Delete a meal
  const deleteMeal = (mealToDelete: Meal = selectedMeal!) => {
    if (!mealToDelete) return;

    deleteMealApi(mealToDelete.id!)
      .then(() => {
        setMeals(meals.filter((m) => m.id !== mealToDelete.id));
        setSelectedMeal(null);
        showToast('Meal deleted successfully');
      })
      .catch((err) => {
        console.error('Error deleting meal:', err);
        showToast('Error deleting meal');
      });
  };

  useEffect(() => {
    // No need to reset selectedMeal when meals update
  }, [meals]);

  useEffect(() => {
    // Reset selected meal when changing views
    setSelectedMeal(null);
    setEditedIngredient(null);
  }, [currentView]);

  useEffect(() => {
    fetchMeals();
  }, [mealTypeFilter]);

  // Filter meals based on search term
  const filteredMeals = meals.filter((meal) =>
    meal.name.toLowerCase().includes(mealFilter.toLowerCase()),
  );

  // Function to refresh meals after adding a new one
  const handleRecipeAdded = () => {
    getMeals()
      .then((meals) => {
        setMeals(meals);
        showToast('New recipe added successfully!');
        setCurrentView('main'); // Return to main view
      })
      .catch((err) => {
        console.error('Error fetching meals:', err);
        showToast('Error loading meals');
      });
  };

  // Update input field for editing ingredient
  const handleIngredientChange = (
    field: keyof Ingredient,
    value: string | number,
  ) => {
    if (!editedIngredient) return;
    setEditedIngredient({
      ...editedIngredient,
      [field]: value,
    });
  };

  // Add a function to fetch meals directly
  const fetchMeals = () => {
    setLoading(true);
    const mealType =
      mealTypeFilter !== 'All' ? mealTypeFilter.toLowerCase() : undefined;

    getMeals(mealType)
      .then((meals) => {
        setMeals(meals);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching meals:', err);
        setLoading(false);
        showToast('Error fetching meals');
      });
  };

  // Fix the handleSaveSteps function
  const handleSaveSteps = async (mealId: number, steps: Step[]) => {
    try {
      setLoading(true);

      // Replace all steps using the API service
      await replaceAllSteps(mealId, steps);

      // Fetch fresh data from the server but keep the selected meal visible
      const freshMeals = await getMeals();

      // Update the meals array
      setMeals(freshMeals);

      // Keep the currently selected meal, but with updated data
      if (selectedMeal) {
        const updatedSelectedMeal = freshMeals.find(
          (m) => m.id === selectedMeal.id,
        );
        if (updatedSelectedMeal) {
          setSelectedMeal(updatedSelectedMeal);
        }
      }

      showToast('Recipe steps saved successfully');
    } catch (error) {
      console.error('Error saving steps:', error);
      showToast('Error saving steps');
    } finally {
      setLoading(false);
    }
  };

  // Set view mode when a new meal is selected
  useEffect(() => {
    setEditMode(false);
    setEditingIngredientIndex(-1);
    setEditedIngredient(null);
  }, [selectedMeal?.id]);

  // Function to toggle between edit and view modes
  const toggleEditMode = () => {
    // If switching from edit to view mode, save changes and reset any active editing
    if (editMode && selectedMeal) {
      setEditingIngredientIndex(-1);
      setEditedIngredient(null);
      // Save the current meal state when exiting edit mode and then navigate back to the list
      handleUpdateMeal(selectedMeal).then(() => {
        setSelectedMeal(null);
      });
    }
    setEditMode(!editMode);
  };

  // Function to handle meal updates
  const handleUpdateMeal = async (updatedMeal: Meal) => {
    if (!updatedMeal.id) return;

    try {
      setLoading(true);
      const result = await updateMealApi(updatedMeal.id, {
        id: updatedMeal.id,
        name: updatedMeal.name,
        effort: updatedMeal.effort,
        hasRedMeat: updatedMeal.hasRedMeat,
        url: updatedMeal.url,
        mealType: updatedMeal.mealType,
        ingredients: updatedMeal.ingredients,
        steps: updatedMeal.steps,
      });

      // Update the selected meal with the result from the backend
      setSelectedMeal(result);
      
      // Update the meals list as well
      setMeals(prev => 
        prev.map(meal => meal.id === result.id ? result : meal)
      );

      showToast('Meal updated successfully');
    } catch (error) {
      console.error('Error updating meal:', error);
      showToast('Error updating meal');
      // Revert the optimistic update if it failed
      // This would require storing the previous state, but for now we'll refetch
      fetchMeals();
    } finally {
      setLoading(false);
    }
  };

  // Render the main menu with options
  const renderMainView = () => {
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
                onClick={() => setCurrentView('browse')}
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
                  <MenuBookIcon
                    sx={{
                      fontSize: 48,
                      color: '#6b8c5d',
                    }}
                  />
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
                  sx={{
                    fontSize: '14px',
                    maxWidth: '80%',
                    lineHeight: 1.5,
                  }}
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
                onClick={() => setCurrentView('add')}
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
                  <AddIcon
                    sx={{
                      fontSize: 48,
                      color: '#ffffff',
                    }}
                  />
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
                  sx={{
                    fontSize: '14px',
                    maxWidth: '80%',
                    lineHeight: 1.5,
                  }}
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

  // Render the browse meals view
  const renderBrowseView = () => {
    // If a meal is selected, show the full-width editing view
    if (selectedMeal) {
      return renderMealEditView();
    }

    // Otherwise show the full-width meals list
    return (
      <Fade in={true}>
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
              onClick={() => setCurrentView('main')}
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
                fontFamily:
                  '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                fontWeight: 600,
                color: '#3a3a3a',
              }}
            >
              Browse Meals
            </Typography>
          </Stack>

          {/* Full-width meals list */}
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                fontWeight: 600,
                mb: 2,
              }}
            >
              Available Meals
            </Typography>
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Search Meals"
                variant="outlined"
                size="small"
                value={mealFilter}
                onChange={(e) => setMealFilter(e.target.value)}
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
                    variant={
                      mealTypeFilter === type ? 'contained' : 'outlined'
                    }
                    onClick={() => setMealTypeFilter(type)}
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
                  if (meal) setSelectedMeal(meal);
                }}
                rowSelection={false}
                disableRowSelectionOnClick
                hideFooter={true}
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
      </Fade>
    );
  };

  // Render the full-width meal editing view
  const renderMealEditView = () => {
    if (!selectedMeal) return null;

    return (
      <Fade in={true}>
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
              onClick={() => setSelectedMeal(null)}
              aria-label="back to meals list"
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
                fontFamily:
                  '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                fontWeight: 600,
                color: '#3a3a3a',
              }}
            >
              {selectedMeal.name}
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

          {/* Full-width recipe details */}
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
              {/* Meal Type Selector - only show in edit mode */}
              {editMode && (
                <Box sx={{ mb: 3 }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="meal-type-edit-label">Meal Type</InputLabel>
                    <Select
                      labelId="meal-type-edit-label"
                      id="meal-type-edit-select"
                      value={selectedMeal.mealType}
                      label="Meal Type"
                      onChange={(e) => {
                        const updatedMeal = {
                          ...selectedMeal,
                          mealType: e.target.value,
                        };
                        setSelectedMeal(updatedMeal);
                      }}
                    >
                      <MenuItem value="breakfast">Breakfast</MenuItem>
                      <MenuItem value="lunch">Lunch</MenuItem>
                      <MenuItem value="dinner">Dinner</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}

              <Stack
                direction="row"
                spacing={2}
                sx={{
                  mb: 3,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
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
                  {selectedMeal.mealType.charAt(0).toUpperCase() + selectedMeal.mealType.slice(1)}
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
                  Effort Level: {selectedMeal.effort}
                </Box>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    bgcolor: selectedMeal.hasRedMeat
                      ? alpha(theme.palette.secondary.main, 0.08)
                      : alpha(theme.palette.success.main, 0.08),
                    color: selectedMeal.hasRedMeat
                      ? theme.palette.secondary.main
                      : theme.palette.success.main,
                    py: 0.5,
                    px: 1.5,
                    borderRadius: 4,
                    fontWeight: 500,
                    fontSize: '0.875rem',
                  }}
                >
                  {selectedMeal.hasRedMeat
                    ? '🥩 Red Meat'
                    : '🥗 No Red Meat'}
                </Box>
              </Stack>

              {selectedMeal.url && (
                <Button
                  variant="contained"
                  color="primary"
                  href={selectedMeal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ mb: 3 }}
                >
                  View Recipe Online
                </Button>
              )}

              <Divider sx={{ my: 3 }} />

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                  }}
                >
                  Ingredients:
                </Typography>
                {editMode && (
                  <Button
                    variant="outlined"
                    onClick={addIngredient}
                    startIcon={<AddIcon />}
                    size="small"
                  >
                    Add Ingredient
                  </Button>
                )}
              </Box>

              {selectedMeal.ingredients.length > 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    mt: 2,
                    mb: 4,
                  }}
                >
                  {selectedMeal.ingredients.map((ing, index) => (
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
                        borderColor: alpha(
                          theme.palette.primary.main,
                          0.1,
                        ),
                        boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.05)}`,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: alpha(
                            theme.palette.primary.main,
                            0.3,
                          ),
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
                                onChange={(e) =>
                                  handleIngredientChange(
                                    'name',
                                    e.target.value,
                                  )
                                }
                              />
                            </Grid>
                            <Grid item xs={3}>
                              <TextField
                                label="quantity"
                                size="small"
                                type="number"
                                fullWidth
                                value={editedIngredient?.quantity || 0}
                                onChange={(e) =>
                                  handleIngredientChange(
                                    'quantity',
                                    parseFloat(e.target.value),
                                  )
                                }
                              />
                            </Grid>
                            <Grid item xs={3}>
                              <TextField
                                label="unit"
                                size="small"
                                fullWidth
                                value={editedIngredient?.unit || ''}
                                onChange={(e) =>
                                  handleIngredientChange(
                                    'unit',
                                    e.target.value,
                                  )
                                }
                              />
                            </Grid>
                          </Grid>
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 1,
                              justifyContent: 'flex-end',
                              mt: 1,
                            }}
                          >
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={saveIngredient}
                              sx={{ borderRadius: 6 }}
                            >
                              Save
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={cancelIngredientEdit}
                              sx={{ borderRadius: 6 }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <>
                          <Typography fontWeight={500}>
                            {`${ing.quantity ? ing.quantity + ' ' : ''}${ing.unit ? ing.unit + ' ' : ''}${ing.name}`.trim()}
                          </Typography>
                          {editMode && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                onClick={() => startEditing(ing)}
                                data-testid={`edit-ingredient-${ing.id}`}
                                size="small"
                                sx={{ borderRadius: 6 }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outlined"
                                color="error"
                                onClick={() => deleteIngredient(ing.id!)}
                                size="small"
                                sx={{ borderRadius: 6 }}
                              >
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
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1, mb: 4, fontStyle: 'italic' }}
                >
                  No ingredients added yet.
                </Typography>
              )}

              {/* Recipe Steps section - only show if there are steps or in edit mode */}
              {(selectedMeal?.steps && selectedMeal.steps.length > 0) ||
              editMode ? (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Recipe Steps
                  </Typography>

                  <StepsEditor
                    steps={selectedMeal.steps || []}
                    onChange={(updatedSteps) => {
                      if (editMode) {
                        setSelectedMeal({
                          ...selectedMeal,
                          steps: updatedSteps,
                        });
                      }
                    }}
                    readOnly={!editMode}
                  />
                  {editMode && (
                    <Box
                      sx={{
                        mt: 2,
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() =>
                          handleSaveSteps(
                            selectedMeal.id!,
                            selectedMeal.steps || [],
                          )
                        }
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
      </Fade>
    );
  };

  // Render the add recipe view
  const renderAddView = () => {
    return (
      <Fade in={true}>
        <Box sx={{ py: 3, px: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <IconButton
              onClick={() => setCurrentView('main')}
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
                fontFamily:
                  '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                fontWeight: 600,
                color: '#3a3a3a',
              }}
            >
              Add New Recipe
            </Typography>
          </Stack>
          <AddRecipeForm onRecipeAdded={handleRecipeAdded} />
        </Box>
      </Fade>
    );
  };

  return (
    <Box
      data-testid="meal-management-tab"
      sx={{
        backgroundColor: '#F7F5F2', // earthyNeutrals mainBg
        minHeight: '100vh',
        color: '#3a3a3a', // earthyNeutrals text
      }}
    >
      {currentView === 'main' && renderMainView()}
      {currentView === 'browse' && renderBrowseView()}
      {currentView === 'add' && renderAddView()}
    </Box>
  );
};
