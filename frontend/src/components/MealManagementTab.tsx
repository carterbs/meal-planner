import React, { useEffect, useState } from "react";
import { Meal, Ingredient } from "../types";
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

        // Add to the UI temporarily
        const updatedMeal = {
            ...selectedMeal,
            ingredients: [...selectedMeal.ingredients, newIngredient]
        };
        setSelectedMeal(updatedMeal);
        setEditingIngredientIndex(updatedMeal.ingredients.length - 1);
        setEditedIngredient(newIngredient);
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
        fetch(`/api/meals/${selectedMeal.id}/ingredients`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedIngredients),
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to update ingredients");
                // Update local state
                setSelectedMeal(updatedMeal);
                setEditingIngredientIndex(null);
                setEditedIngredient(null);
                showToast("Ingredient updated successfully");

                // Also update the meal in the meals array
                const updatedMeals = meals.map(m => m.id === selectedMeal.id ? updatedMeal : m);
                setMeals(updatedMeals);
            })
            .catch((err) => {
                console.error("Error updating ingredients:", err);
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
        fetch(`/api/meals/${selectedMeal.id}/ingredients`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedIngredients),
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to delete ingredient");
                // Update local state
                setSelectedMeal(updatedMeal);
                showToast("Ingredient deleted successfully");

                // Also update the meal in the meals array
                const updatedMeals = meals.map(m => m.id === selectedMeal.id ? updatedMeal : m);
                setMeals(updatedMeals);
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
        setSelectedMeal(null);
        setEditedIngredient(null);
    }, [meals]);

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

    // Render the main menu with options
    const renderMainView = () => {
        return (
            <Box sx={{ py: 3 }} data-testid="meal-management-tab">
                <Typography variant="h4" gutterBottom>
                    Meal Library
                </Typography>
                <Grid container spacing={4} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={6}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardActionArea
                                onClick={() => setCurrentView("browse")}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    alignItems: 'center',
                                    padding: 4
                                }}
                            >
                                <MenuBookIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h5" component="div" gutterBottom>
                                    Browse Meals
                                </Typography>
                                <Typography variant="body1" color="text.secondary" align="center">
                                    View, search, and manage your saved recipes
                                </Typography>
                            </CardActionArea>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardActionArea
                                onClick={() => setCurrentView("add")}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    alignItems: 'center',
                                    padding: 4
                                }}
                            >
                                <AddIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                                <Typography variant="h5" component="div" gutterBottom>
                                    Add New Recipe
                                </Typography>
                                <Typography variant="body1" color="text.secondary" align="center">
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
                <Box sx={{ py: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                        <IconButton onClick={() => setCurrentView("main")} aria-label="back to main menu">
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography variant="h5">Browse Meals</Typography>
                    </Stack>

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom>
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
                                />
                            </Box>
                            <Paper sx={{ height: 400, width: '100%', boxShadow: 'none' }}>
                                <DataGrid
                                    rows={filteredMeals}
                                    columns={columns}
                                    getRowId={(row) => row.id}
                                    initialState={{
                                        sorting: {
                                            sortModel: [{ field: 'mealName', sort: 'asc' }],
                                        },
                                    }}
                                    onRowClick={(params) => {
                                        const meal = meals.find(m => m.id === params.id);
                                        if (meal) setSelectedMeal(meal);
                                    }}
                                    rowSelection={false}
                                    disableRowSelectionOnClick
                                    autoHeight
                                    density="comfortable"
                                    sx={{
                                        '& .MuiDataGrid-row:hover': {
                                            cursor: 'pointer',
                                            backgroundColor: 'action.hover',
                                            boxShadow: 'none',
                                        },
                                        '& .MuiDataGrid-row.Mui-selected': {
                                            backgroundColor: 'primary.light',
                                        },
                                        '& .MuiDataGrid-cell': {
                                            textDecoration: 'none',
                                            borderBottom: '1px solid rgba(224, 224, 224, 1)',
                                        },
                                        '& .MuiDataGrid-row:focus, & .MuiDataGrid-cell:focus': {
                                            outline: 'none',
                                        },
                                        '& .MuiDataGrid-row': {
                                            boxShadow: 'none',
                                        },
                                        border: '1px solid rgba(224, 224, 224, 1)',
                                        '& .MuiDataGrid-columnHeaders': {
                                            borderBottom: '1px solid rgba(224, 224, 224, 1)',
                                        },
                                    }}
                                />
                            </Paper>
                        </Grid>

                        {selectedMeal && (
                            <Grid item xs={12} md={6}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            {selectedMeal.mealName}
                                        </Typography>

                                        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                                            Effort Level: {selectedMeal.relativeEffort}
                                        </Typography>

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

                                        <Divider sx={{ my: 2 }} />

                                        <Typography variant="subtitle1" gutterBottom>
                                            Ingredients:
                                        </Typography>

                                        <Button
                                            variant="outlined"
                                            onClick={addIngredient}
                                            sx={{ mb: 2 }}
                                        >
                                            Add Ingredient
                                        </Button>

                                        {selectedMeal.ingredients.length === 0 ? (
                                            <Typography color="text.secondary">
                                                No ingredients listed for this meal.
                                            </Typography>
                                        ) : (
                                            <Box sx={{ mt: 1 }}>
                                                {selectedMeal.ingredients.map((ing, index) => (
                                                    <Box
                                                        key={ing.ID || index}
                                                        sx={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            mb: 1,
                                                            p: 1,
                                                            borderRadius: 1,
                                                            bgcolor: 'background.paper',
                                                            border: "1px solid",
                                                            borderColor: "divider"
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
                                                                    <Button variant="contained" color="primary" onClick={saveIngredient}>
                                                                        Save
                                                                    </Button>
                                                                    <Button variant="outlined" onClick={cancelIngredientEdit}>
                                                                        Cancel
                                                                    </Button>
                                                                </Box>
                                                            </Box>
                                                        ) : (
                                                            <>
                                                                <Typography>
                                                                    {`${ing.Quantity ? ing.Quantity + " " : ""}${ing.Unit ? ing.Unit + " " : ""}${ing.Name}`.trim()}
                                                                </Typography>
                                                                <Box sx={{ display: "flex", gap: 1 }}>
                                                                    <Button
                                                                        variant="outlined"
                                                                        onClick={() => startEditing(ing)}
                                                                        data-testid={`edit-ingredient-${ing.ID}`}
                                                                        size="small"
                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                    <Button
                                                                        variant="outlined"
                                                                        color="error"
                                                                        onClick={() => deleteIngredient(ing.ID)}
                                                                        size="small"
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