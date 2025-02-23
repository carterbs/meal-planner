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
    TextField
} from "@mui/material";
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { format } from 'date-fns';

interface MealManagementTabProps {
    showToast: (message: string) => void;
}

export const MealManagementTab: React.FC<MealManagementTabProps> = ({ showToast }) => {
    const [meals, setMeals] = useState<Meal[]>([]);
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
    const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
    const [editedIngredient, setEditedIngredient] = useState<Ingredient | null>(null);
    const [mealFilter, setMealFilter] = useState<string>("");

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
    ];

    // Function to start editing a specific ingredient based on its index in the meal's ingredients list
    const startEditing = (ingredient: Ingredient) => {
        if (!selectedMeal) return;
        setEditedIngredient({ ...ingredient });
    };

    // Function to cancel editing for the current ingredient
    const cancelIngredientEdit = () => {
        setEditingIngredientIndex(null);
        setEditedIngredient(null);
    };

    // Update handleIngredientChange to update the single edited ingredient
    const handleIngredientChange = (field: "Name" | "Quantity" | "Unit", value: string) => {
        if (!editedIngredient) return;
        setEditedIngredient({
            ...editedIngredient,
            [field]: field === "Quantity" ? (value === "" || isNaN(Number(value)) ? null : Number(value)) : value,
        });
    };

    // Function to save the updated ingredient
    const saveIngredient = () => {
        if (!selectedMeal || !editedIngredient) return;

        fetch(`/api/meals/${selectedMeal.id}/ingredients/${editedIngredient.ID}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editedIngredient),
        })
            .then((res) => res.json())
            .then((updatedMeal: Meal) => {
                setSelectedMeal(updatedMeal);
                setEditedIngredient(null);
                showToast("Ingredient updated successfully");
            })
            .catch((err) => console.error("Error updating ingredient", err));
    };

    // Function to delete a single ingredient
    const deleteIngredient = (ingredientId: number) => {
        if (!selectedMeal) return;
        fetch(`/api/meals/${selectedMeal.id}/ingredients/${ingredientId}`, {
            method: "DELETE",
        })
            .then((res) => res.json())
            .then((updatedMeal: Meal) => {
                setSelectedMeal(updatedMeal);
                showToast("Ingredient deleted successfully");
            })
            .catch((err) => console.error("Error deleting ingredient", err));
    };

    const deleteMeal = () => {
        if (!selectedMeal) return;

        fetch(`/api/meals/${selectedMeal.id}`, {
            method: "DELETE",
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to delete meal");
                setMeals(meals.filter(m => m.id !== selectedMeal.id));
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
    }, []);

    // Filter meals based on search term
    const filteredMeals = meals.filter((meal) =>
        meal.mealName.toLowerCase().includes(mealFilter.toLowerCase())
    );

    return (
        <Box sx={{ p: 2 }} data-testid="meal-management-tab">
            <Typography variant="h4" gutterBottom>
                Meal Library
            </Typography>
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
                {selectedMeal && meals.length > 0 && (
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" gutterBottom>
                            Meal Details
                        </Typography>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="h5" gutterBottom>
                                    {selectedMeal.mealName}
                                </Typography>
                                <Typography variant="body1">
                                    Effort Level: {selectedMeal.relativeEffort}
                                </Typography>
                                <Typography variant="body1">
                                    Contains Red Meat: {selectedMeal.redMeat ? "Yes" : "No"}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    Last Eaten: {selectedMeal.lastPlanned ?
                                        format(new Date(selectedMeal.lastPlanned), 'MMM d, yyyy') :
                                        'Never'}
                                </Typography>
                                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        onClick={deleteMeal}
                                        data-testid="delete-meal-button"
                                    >
                                        Delete Meal
                                    </Button>
                                </Box>
                                <Typography variant="h6" sx={{ mt: 2 }}>
                                    Ingredients
                                </Typography>
                                {selectedMeal.ingredients.length === 0 ? (
                                    <Typography>No ingredients found.</Typography>
                                ) : (
                                    <Box component="ul" sx={{ listStyle: 'none', p: 0 }}>
                                        {selectedMeal.ingredients.map((ing) => (
                                            <Box
                                                component="li"
                                                key={ing.ID}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    p: 1,
                                                    borderBottom: '1px solid',
                                                    borderColor: 'divider',
                                                    '&:last-child': {
                                                        borderBottom: 'none',
                                                    },
                                                }}
                                            >
                                                {editedIngredient && editedIngredient.ID === ing.ID ? (
                                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: '100%' }}>
                                                        <TextField
                                                            label="Name"
                                                            value={editedIngredient?.Name || ""}
                                                            onChange={(e) => handleIngredientChange("Name", e.target.value)}
                                                            fullWidth
                                                        />
                                                        <TextField
                                                            label="Quantity"
                                                            type="number"
                                                            value={editedIngredient?.Quantity === null ? "" : editedIngredient?.Quantity}
                                                            onChange={(e) => handleIngredientChange("Quantity", e.target.value)}
                                                            fullWidth
                                                        />
                                                        <TextField
                                                            label="Unit"
                                                            value={editedIngredient?.Unit || ""}
                                                            onChange={(e) => handleIngredientChange("Unit", e.target.value)}
                                                            fullWidth
                                                        />
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
    );
};