import React, { useEffect, useState } from "react";
import { Meal, Ingredient } from "../types";
import {
    Box,
    Typography,
    Grid,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemButton,
    Card,
    CardContent,
    Button,
    TextField
} from "@mui/material";

interface MealManagementTabProps {
    showToast: (message: string) => void;
}

export const MealManagementTab: React.FC<MealManagementTabProps> = ({ showToast }) => {
    const [meals, setMeals] = useState<Meal[]>([]);
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
    const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
    const [editedIngredient, setEditedIngredient] = useState<Ingredient | null>(null);
    const [mealFilter, setMealFilter] = useState<string>("");

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

    // Function to save the updated ingredient by merging it back into the meal's ingredients and making a PUT request
    const saveIngredient = () => {
        if (!selectedMeal || !editedIngredient) return;

        // Call the new endpoint with the single ingredient payload.
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

    // Function to delete a single ingredient by its index using a DELETE request
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

    // Add this function inside MealManagementTab component
    const deleteMeal = () => {
        if (!selectedMeal) return;

        fetch(`/api/meals/${selectedMeal.id}`, {
            method: "DELETE",
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to delete meal");
                // Remove meal from state and clear selection
                setMeals(meals.filter(m => m.id !== selectedMeal.id));
                setSelectedMeal(null);
                showToast("Meal deleted successfully");
            })
            .catch((err) => {
                console.error("Error deleting meal:", err);
                showToast("Error deleting meal");
            });
    };

    // Add this useEffect to clear selected meal when meals list changes
    useEffect(() => {
        setSelectedMeal(null);
        setEditedIngredient(null);
    }, [meals]);

    // Existing useEffect for fetching meals...
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
                    {meals.length === 0 ? (
                        <Typography>Loading meals...</Typography>
                    ) : (
                        <Paper variant="outlined">
                            <Box sx={{ p: 1 }}>
                                <TextField
                                    label="Search Meals"
                                    variant="outlined"
                                    size="small"
                                    value={mealFilter}
                                    onChange={(e) => setMealFilter(e.target.value)}
                                    fullWidth
                                    sx={{ mb: 1 }}
                                />
                            </Box>
                            <List data-testid="meals-list">
                                {meals
                                    .filter((meal) =>
                                        meal.mealName.toLowerCase().includes(mealFilter.toLowerCase())
                                    )
                                    .sort((a, b) => a.mealName.toLowerCase().localeCompare(b.mealName.toLowerCase()))
                                    .map((meal) => (
                                        <ListItem key={meal.id} disablePadding>
                                            <ListItemButton
                                                selected={selectedMeal?.id === meal.id}
                                                onClick={() => setSelectedMeal(meal)}
                                            >
                                                <ListItemText
                                                    primary={meal.mealName}
                                                    secondary={`Effort: ${meal.relativeEffort}`}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                            </List>
                        </Paper>
                    )}
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
                                    Last Eaten: {new Date(selectedMeal.lastPlanned).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
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
                                    <List>
                                        {selectedMeal.ingredients.map((ing) => (
                                            <ListItem key={ing.ID}>
                                                {editedIngredient && editedIngredient.ID === ing.ID ? (
                                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                                        <TextField
                                                            label="Name"
                                                            value={editedIngredient?.Name || ""}
                                                            onChange={(e) => handleIngredientChange("Name", e.target.value)}
                                                        />
                                                        <TextField
                                                            label="Quantity"
                                                            type="number"
                                                            value={editedIngredient?.Quantity === null ? "" : editedIngredient?.Quantity}
                                                            onChange={(e) => handleIngredientChange("Quantity", e.target.value)}
                                                        />
                                                        <TextField
                                                            label="Unit"
                                                            value={editedIngredient?.Unit || ""}
                                                            onChange={(e) => handleIngredientChange("Unit", e.target.value)}
                                                        />
                                                        <Box sx={{ display: "flex", gap: 1 }}>
                                                            <Button variant="contained" color="primary" onClick={saveIngredient}>
                                                                Save
                                                            </Button>
                                                            <Button variant="outlined" onClick={cancelIngredientEdit}>
                                                                Cancel
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                                                        <ListItemText primary={`${ing.Quantity ? ing.Quantity + " " : ""}${ing.Unit ? ing.Unit + " " : ""}${ing.Name}`.trim()} />
                                                        <Box sx={{ display: "flex", gap: 1 }}>
                                                            <Button
                                                                variant="outlined"
                                                                onClick={() => startEditing(ing)}
                                                                data-testid={`edit-ingredient-${ing.ID}`}
                                                            >
                                                                Edit
                                                            </Button>
                                                            <Button variant="outlined" color="error" onClick={() => deleteIngredient(ing.ID)}>
                                                                Delete
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                )}
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};