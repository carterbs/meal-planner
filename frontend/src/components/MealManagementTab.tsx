import React, { useEffect, useState } from "react";
import { Meal, Ingredient, Step } from "../types";
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
    Fade
} from "@mui/material";
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { format } from 'date-fns';
import AddRecipeForm from "../AddRecipeForm";
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import StepsEditor from './StepsEditor';

interface MealManagementTabProps {
    showToast: (message: string) => void;
}

export const MealManagementTab: React.FC<MealManagementTabProps> = ({ showToast }) => {
    const [meals, setMeals] = useState<Meal[]>([]);
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
    const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
    const [editedIngredient, setEditedIngredient] = useState<Ingredient | null>(null);
    const [mealFilter, setMealFilter] = useState<string>("");
    const [currentView, setCurrentView] = useState<"main" | "browse" | "add">("main");
    const [loading, setLoading] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>("");
    const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success');
    const theme = useTheme();

    // Column definitions for the DataGrid
    const columns: GridColDef[] = [
        {
            field: 'mealName',
            headerName: 'Meal Name',
            flex: 1,
            minWidth: 200,
        },
        {
            field: 'relativeEffort',
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
            }
        },
        {
            field: 'redMeat',
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
                return <Button
                    variant="text"
                    size="small"
                    href={params.value}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Link
                </Button>
            },
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 120,
            renderCell: (params) => (
                <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        const meal = meals.find(m => m.id === params.id);
                        if (meal) {
                            setSelectedMeal(meal);
                            deleteMeal(meal);
                        }
                    }}
                >
                    Delete
                </Button>
            ),
        }
    ];

    // Handle adding a new ingredient to a meal
    const addIngredient = () => {
        if (!selectedMeal) return;

        // Create a default new ingredient
        const newIngredient: Ingredient = {
            ID: Date.now(), // Temporary ID for the UI
            Name: "",
            Quantity: 0,
            Unit: ""
        };

        // Create updated meal with the new ingredient
        const updatedMeal = {
            ...selectedMeal,
            ingredients: [...selectedMeal.ingredients, newIngredient]
        };

        // Update the selected meal directly
        setSelectedMeal(updatedMeal);
        setEditingIngredientIndex(updatedMeal.ingredients.length - 1);
        setEditedIngredient(newIngredient);

        // Update the meals array with the new meal data
        setMeals(prev => prev.map(m => m.id === selectedMeal.id ? updatedMeal : m));
    };

    // Start editing an ingredient
    const startEditing = (ingredient: Ingredient) => {
        if (!selectedMeal) return;
        const index = selectedMeal.ingredients.findIndex(i => i.ID === ingredient.ID);
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
        if (!selectedMeal || editingIngredientIndex === null || !editedIngredient) return;

        // Update the ingredient in the selectedMeal 
        const updatedIngredients = [...selectedMeal.ingredients];
        updatedIngredients[editingIngredientIndex] = editedIngredient;

        const updatedMeal = {
            ...selectedMeal,
            ingredients: updatedIngredients
        };

        // Save to backend
        fetch(`/api/meals/${selectedMeal.id}/ingredients/${editedIngredient.ID}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(editedIngredient),
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to update ingredient");

                // First, update the selected meal directly 
                setSelectedMeal(updatedMeal);
                setEditingIngredientIndex(null);
                setEditedIngredient(null);

                // Then update the meals array with the new meal data
                setMeals(prev => prev.map(m => m.id === selectedMeal.id ? updatedMeal : m));

                showToast("Ingredient updated successfully");
            })
            .catch((err) => {
                console.error("Error updating ingredient:", err);
                showToast("Error updating ingredient");
            });
    };

    // Delete an ingredient
    const deleteIngredient = (ingredientId: number) => {
        if (!selectedMeal) return;

        const updatedIngredients = selectedMeal.ingredients.filter(i => i.ID !== ingredientId);
        const updatedMeal = {
            ...selectedMeal,
            ingredients: updatedIngredients
        };

        // Save to backend
        fetch(`/api/meals/${selectedMeal.id}/ingredients/${ingredientId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            }
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to delete ingredient");

                // First, update the selected meal directly
                setSelectedMeal(updatedMeal);

                // Then update the meals array with the new meal data
                setMeals(prev => prev.map(m => m.id === selectedMeal.id ? updatedMeal : m));

                showToast("Ingredient deleted successfully");
            })
            .catch((err) => {
                console.error("Error deleting ingredient:", err);
                showToast("Error deleting ingredient");
            });
    };

    // Delete a meal
    const deleteMeal = (mealToDelete: Meal = selectedMeal!) => {
        if (!mealToDelete) return;

        fetch(`/api/meals/${mealToDelete.id}`, {
            method: "DELETE",
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to delete meal");
                setMeals(meals.filter(m => m.id !== mealToDelete.id));
                setSelectedMeal(null);
                showToast("Meal deleted successfully");
            })
            .catch((err) => {
                console.error("Error deleting meal:", err);
                showToast("Error deleting meal");
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
        fetch("/api/meals")
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then((data: Meal[]) => setMeals(data))
            .catch((err) => {
                console.error("Error fetching meals:", err);
                showToast("Error loading meals");
            });
    }, [showToast]);

    // Filter meals based on search term
    const filteredMeals = meals.filter((meal) =>
        meal.mealName.toLowerCase().includes(mealFilter.toLowerCase())
    );

    // Function to refresh meals after adding a new one
    const handleRecipeAdded = () => {
        fetch("/api/meals")
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then((data: Meal[]) => {
                setMeals(data);
                showToast("New recipe added successfully!");
                setCurrentView("main"); // Return to main view
            })
            .catch((err) => {
                console.error("Error fetching meals:", err);
                showToast("Error loading meals");
            });
    };

    // Update input field for editing ingredient
    const handleIngredientChange = (field: keyof Ingredient, value: string | number) => {
        if (!editedIngredient) return;
        setEditedIngredient({
            ...editedIngredient,
            [field]: value
        });
    };

    // Add a function to fetch meals directly
    const fetchMeals = () => {
        fetch("/api/meals")
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then((data: Meal[]) => setMeals(data))
            .catch((err) => {
                console.error("Error fetching meals:", err);
                showToast("Error loading meals");
            });
    };

    // Fix the handleSaveSteps function
    const handleSaveSteps = async (mealId: number, steps: Step[]) => {
        try {
            setLoading(true);

            // Delete existing steps first, then add new ones in bulk
            await fetch(`/api/meals/${mealId}/steps`, {
                method: 'DELETE',
            });

            // Only add new steps if there are any
            if (steps.length > 0) {
                const response = await fetch(`/api/meals/${mealId}/steps/bulk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ instructions: steps.map(step => step.instruction) }),
                });

                if (!response.ok) {
                    throw new Error('Failed to save steps');
                }
            }

            // Fetch fresh data from the server but keep the selected meal visible
            const res = await fetch("/api/meals");
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data: Meal[] = await res.json();

            // Update the meals array
            setMeals(data);

            // Keep the currently selected meal, but with updated data
            if (selectedMeal) {
                const updatedSelectedMeal = data.find(m => m.id === selectedMeal.id);
                if (updatedSelectedMeal) {
                    setSelectedMeal(updatedSelectedMeal);
                }
            }

            showToast("Recipe steps saved successfully");
        } catch (error) {
            console.error('Error saving steps:', error);
            showToast("Error saving steps");
        } finally {
            setLoading(false);
        }
    };

    // Render the main menu with options
    const renderMainView = () => {
        return (
            <Box sx={{ py: 3 }} data-testid="meal-management-tab">
                <Typography
                    variant="h4"
                    gutterBottom
                    sx={{
                        fontFamily: 'Playfair Display, serif',
                        fontWeight: 700,
                        mb: 4,
                        color: theme.palette.text.primary,
                        position: 'relative',
                        display: 'inline-block',
                        '&:after': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            bottom: -8,
                            width: '40%',
                            height: 3,
                            background: `linear-gradient(to right, ${theme.palette.primary.main}, transparent)`,
                            borderRadius: 2
                        }
                    }}
                >
                    Meal Library
                </Typography>
                <Grid container spacing={5} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={6}>
                        <Card
                            sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: 3,
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                '&:hover': {
                                    transform: 'translateY(-8px)',
                                    boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.15)}`,
                                }
                            }}
                        >
                            <CardActionArea
                                onClick={() => setCurrentView("browse")}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    alignItems: 'center',
                                    padding: 5,
                                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.15)} 100%)`,
                                }}
                            >
                                <Box
                                    sx={{
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        borderRadius: '50%',
                                        p: 3,
                                        mb: 3,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.2)}`,
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                    }}
                                >
                                    <MenuBookIcon
                                        sx={{
                                            fontSize: 64,
                                            color: theme.palette.primary.main,
                                        }}
                                    />
                                </Box>
                                <Typography
                                    variant="h5"
                                    component="div"
                                    gutterBottom
                                    sx={{
                                        fontFamily: 'Playfair Display, serif',
                                        fontWeight: 700,
                                        color: theme.palette.primary.dark,
                                        mb: 2
                                    }}
                                >
                                    Browse Meals
                                </Typography>
                                <Typography
                                    variant="body1"
                                    color="text.secondary"
                                    align="center"
                                    sx={{
                                        fontWeight: 500,
                                        maxWidth: '80%',
                                        lineHeight: 1.6
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
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: 3,
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                                '&:hover': {
                                    transform: 'translateY(-8px)',
                                    boxShadow: `0 12px 30px ${alpha(theme.palette.secondary.main, 0.15)}`,
                                }
                            }}
                        >
                            <CardActionArea
                                onClick={() => setCurrentView("add")}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    alignItems: 'center',
                                    padding: 5,
                                    background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.light, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`,
                                }}
                            >
                                <Box
                                    sx={{
                                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                        borderRadius: '50%',
                                        p: 3,
                                        mb: 3,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: `0 8px 20px ${alpha(theme.palette.secondary.main, 0.2)}`,
                                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                                    }}
                                >
                                    <AddIcon
                                        sx={{
                                            fontSize: 64,
                                            color: theme.palette.secondary.main,
                                        }}
                                    />
                                </Box>
                                <Typography
                                    variant="h5"
                                    component="div"
                                    gutterBottom
                                    sx={{
                                        fontFamily: 'Playfair Display, serif',
                                        fontWeight: 700,
                                        color: theme.palette.secondary.dark,
                                        mb: 2
                                    }}
                                >
                                    Add New Recipe
                                </Typography>
                                <Typography
                                    variant="body1"
                                    color="text.secondary"
                                    align="center"
                                    sx={{
                                        fontWeight: 500,
                                        maxWidth: '80%',
                                        lineHeight: 1.6
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
        return (
            <Fade in={true}>
                <Box sx={{ py: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                        <IconButton onClick={() => setCurrentView("main")} aria-label="back to main menu">
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography
                            variant="h5"
                            sx={{
                                fontFamily: 'Playfair Display, serif',
                                fontWeight: 700,
                            }}
                        >
                            Browse Meals
                        </Typography>
                    </Stack>

                    <Grid container spacing={3} sx={{ flexGrow: 1, height: '100%' }}>
                        <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Typography
                                variant="h6"
                                gutterBottom
                                sx={{
                                    fontWeight: 600,
                                    mb: 2
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
                                        }
                                    }}
                                />
                            </Box>
                            <Paper
                                sx={{
                                    flexGrow: 1,
                                    width: '100%',
                                    boxShadow: 'none',
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: '500px'
                                }}
                            >
                                <DataGrid
                                    rows={filteredMeals}
                                    columns={columns}
                                    getRowId={(row) => row.id}
                                    initialState={{
                                        sorting: {
                                            sortModel: [{ field: 'mealName', sort: 'asc' }],
                                        },
                                        pagination: {
                                            paginationModel: { pageSize: 10 }
                                        }
                                    }}
                                    onRowClick={(params) => {
                                        const meal = meals.find(m => m.id === params.id);
                                        if (meal) setSelectedMeal(meal);
                                    }}
                                    rowSelection={false}
                                    disableRowSelectionOnClick
                                    pageSizeOptions={[5, 10, 25]}
                                    pagination={true}
                                    sx={{
                                        flexGrow: 1,
                                        '& .MuiDataGrid-row:hover': {
                                            cursor: 'pointer',
                                            backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                            boxShadow: 'none',
                                            transition: 'background-color 0.2s ease',
                                        },
                                        '& .MuiDataGrid-row.Mui-selected': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                        },
                                        '& .MuiDataGrid-cell': {
                                            textDecoration: 'none',
                                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                                            padding: '12px 16px',
                                        },
                                        '& .MuiDataGrid-row:focus, & .MuiDataGrid-cell:focus': {
                                            outline: 'none',
                                        },
                                        '& .MuiDataGrid-row': {
                                            boxShadow: 'none',
                                        },
                                        border: 'none',
                                        '& .MuiDataGrid-columnHeaders': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                                            '& .MuiDataGrid-columnHeader': {
                                                padding: '12px 16px',
                                            },
                                            '& .MuiDataGrid-columnHeaderTitle': {
                                                fontWeight: 600,
                                                color: theme.palette.text.primary,
                                            },
                                        },
                                        '& .MuiDataGrid-footerContainer': {
                                            borderTop: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                                        },
                                    }}
                                />
                            </Paper>
                        </Grid>

                        {selectedMeal && (
                            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography
                                    variant="h6"
                                    gutterBottom
                                    sx={{
                                        fontWeight: 600,
                                        mb: 2
                                    }}
                                >
                                    Meal Details
                                </Typography>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 2,
                                        borderColor: alpha(theme.palette.primary.main, 0.1),
                                        boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`,
                                        height: '100%',
                                    }}
                                >
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography
                                            variant="h5"
                                            gutterBottom
                                            sx={{
                                                fontFamily: 'Playfair Display, serif',
                                                fontWeight: 700,
                                                color: theme.palette.primary.dark,
                                                mb: 2
                                            }}
                                        >
                                            {selectedMeal.mealName}
                                        </Typography>

                                        <Stack
                                            direction="row"
                                            spacing={2}
                                            sx={{
                                                mb: 3,
                                                flexWrap: 'wrap',
                                                gap: 1
                                            }}
                                        >
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
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                Effort Level: {selectedMeal.relativeEffort}
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    bgcolor: selectedMeal.redMeat
                                                        ? alpha(theme.palette.secondary.main, 0.08)
                                                        : alpha(theme.palette.success.main, 0.08),
                                                    color: selectedMeal.redMeat
                                                        ? theme.palette.secondary.main
                                                        : theme.palette.success.main,
                                                    py: 0.5,
                                                    px: 1.5,
                                                    borderRadius: 4,
                                                    fontWeight: 500,
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                {selectedMeal.redMeat ? '🥩 Red Meat' : '🥗 No Red Meat'}
                                            </Box>
                                        </Stack>

                                        {selectedMeal.url && (
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                href={selectedMeal.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{ mb: 2 }}
                                            >
                                                View Recipe Online
                                            </Button>
                                        )}

                                        <Divider sx={{ my: 3 }} />

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography
                                                variant="h6"
                                                sx={{
                                                    fontWeight: 600,
                                                    color: theme.palette.text.primary,
                                                }}
                                            >
                                                Ingredients:
                                            </Typography>

                                            <Button
                                                variant="outlined"
                                                color="primary"
                                                onClick={addIngredient}
                                                startIcon={<AddIcon />}
                                                sx={{
                                                    borderRadius: 6,
                                                    px: 2,
                                                    borderWidth: 2,
                                                }}
                                            >
                                                Add Ingredient
                                            </Button>
                                        </Box>

                                        {selectedMeal.ingredients.length === 0 ? (
                                            <Box
                                                sx={{
                                                    textAlign: 'center',
                                                    py: 4,
                                                    px: 2,
                                                    bgcolor: alpha(theme.palette.background.default, 0.5),
                                                    borderRadius: 2,
                                                    border: `1px dashed ${alpha(theme.palette.text.secondary, 0.2)}`,
                                                }}
                                            >
                                                <Typography color="text.secondary">
                                                    No ingredients listed for this meal.
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                    Click "Add Ingredient" to add some!
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Box
                                                sx={{
                                                    mt: 1,
                                                    maxHeight: '400px',
                                                    overflowY: 'auto',
                                                    pr: 1,
                                                    '&::-webkit-scrollbar': {
                                                        width: '8px',
                                                    },
                                                    '&::-webkit-scrollbar-track': {
                                                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                                        borderRadius: '8px',
                                                    },
                                                    '&::-webkit-scrollbar-thumb': {
                                                        backgroundColor: alpha(theme.palette.primary.main, 0.2),
                                                        borderRadius: '8px',
                                                        '&:hover': {
                                                            backgroundColor: alpha(theme.palette.primary.main, 0.3),
                                                        },
                                                    },
                                                }}
                                            >
                                                {selectedMeal.ingredients.map((ing, index) => (
                                                    <Box
                                                        key={ing.ID || index}
                                                        sx={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            mb: 1.5,
                                                            p: 2,
                                                            borderRadius: 2,
                                                            bgcolor: 'background.paper',
                                                            border: "1px solid",
                                                            borderColor: alpha(theme.palette.primary.main, 0.1),
                                                            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.05)}`,
                                                            transition: 'all 0.2s ease',
                                                            '&:hover': {
                                                                borderColor: alpha(theme.palette.primary.main, 0.3),
                                                                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.08)}`,
                                                            }
                                                        }}
                                                    >
                                                        {editingIngredientIndex === index ? (
                                                            <Box sx={{ width: "100%" }}>
                                                                <Grid container spacing={2}>
                                                                    <Grid item xs={6}>
                                                                        <TextField
                                                                            label="Name"
                                                                            size="small"
                                                                            fullWidth
                                                                            value={editedIngredient?.Name || ""}
                                                                            onChange={(e) => handleIngredientChange("Name", e.target.value)}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={3}>
                                                                        <TextField
                                                                            label="Quantity"
                                                                            size="small"
                                                                            type="number"
                                                                            fullWidth
                                                                            value={editedIngredient?.Quantity || 0}
                                                                            onChange={(e) => handleIngredientChange("Quantity", parseFloat(e.target.value))}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={3}>
                                                                        <TextField
                                                                            label="Unit"
                                                                            size="small"
                                                                            fullWidth
                                                                            value={editedIngredient?.Unit || ""}
                                                                            onChange={(e) => handleIngredientChange("Unit", e.target.value)}
                                                                        />
                                                                    </Grid>
                                                                </Grid>
                                                                <Box sx={{ display: "flex", gap: 1, justifyContent: 'flex-end', mt: 1 }}>
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
                                                                    {`${ing.Quantity ? ing.Quantity + " " : ""}${ing.Unit ? ing.Unit + " " : ""}${ing.Name}`.trim()}
                                                                </Typography>
                                                                <Box sx={{ display: "flex", gap: 1 }}>
                                                                    <Button
                                                                        variant="outlined"
                                                                        onClick={() => startEditing(ing)}
                                                                        data-testid={`edit-ingredient-${ing.ID}`}
                                                                        size="small"
                                                                        sx={{ borderRadius: 6 }}
                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                    <Button
                                                                        variant="outlined"
                                                                        color="error"
                                                                        onClick={() => deleteIngredient(ing.ID)}
                                                                        size="small"
                                                                        sx={{ borderRadius: 6 }}
                                                                    >
                                                                        Delete
                                                                    </Button>
                                                                </Box>
                                                            </>
                                                        )}
                                                    </Box>
                                                ))}
                                            </Box>
                                        )}

                                        {/* Recipe Steps section */}
                                        <Box sx={{ mt: 3 }}>
                                            <Typography variant="h6" gutterBottom>
                                                Recipe Steps
                                            </Typography>

                                            {selectedMeal ? (
                                                <>
                                                    <StepsEditor
                                                        steps={selectedMeal.steps || []}
                                                        onChange={(updatedSteps) => {
                                                            setSelectedMeal({
                                                                ...selectedMeal,
                                                                steps: updatedSteps
                                                            });
                                                        }}
                                                    />
                                                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                                        <Button
                                                            variant="contained"
                                                            color="primary"
                                                            onClick={() => handleSaveSteps(selectedMeal.id, selectedMeal.steps || [])}
                                                            disabled={loading}
                                                        >
                                                            Save Steps
                                                        </Button>
                                                    </Box>
                                                </>
                                            ) : (
                                                <StepsEditor
                                                    steps={[]}
                                                    readOnly={true}
                                                    onChange={() => { }}
                                                />
                                            )}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}
                    </Grid>
                </Box>
            </Fade>
        );
    };

    // Render the add recipe view
    const renderAddView = () => {
        return (
            <Fade in={true}>
                <Box sx={{ py: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                        <IconButton onClick={() => setCurrentView("main")} aria-label="back to main menu">
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography variant="h5">Add New Recipe</Typography>
                    </Stack>
                    <AddRecipeForm onRecipeAdded={handleRecipeAdded} />
                </Box>
            </Fade>
        );
    };

    return (
        <Box data-testid="meal-management-tab">
            {currentView === "main" && renderMainView()}
            {currentView === "browse" && renderBrowseView()}
            {currentView === "add" && renderAddView()}
        </Box>
    );
};