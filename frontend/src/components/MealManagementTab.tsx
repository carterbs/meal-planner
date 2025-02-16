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
            [field]: field === "Quantity" ? Number(value) : value,
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
                if (editingIngredientIndex === ingredientId) {
                    setEditingIngredientIndex(null);
                    setEditedIngredient(null);
                }
                showToast("Ingredient deleted successfully");
            })
            .catch((err) => console.error("Error deleting ingredient", err));
    };

    useEffect(() => {
        fetch("/api/meals")
            .then((res) => res.json())
            .then((data: Meal[]) => setMeals(data))
            .catch((err) => console.error("Error fetching meals:", err));
    }, []);

    return (
        <Box sx={{ p: 2 }}>
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
                            <List>
                                {meals
                                    .filter((meal) =>
                                        meal.mealName.toLowerCase().includes(mealFilter.toLowerCase())
                                    )
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
                {selectedMeal && (
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
                                                            value={editedIngredient?.Quantity || 0}
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
                                                        <ListItemText primary={`${ing.Quantity} ${ing.Unit} ${ing.Name}`} />
                                                        <Box sx={{ display: "flex", gap: 1 }}>
                                                            <Button variant="outlined" onClick={() => startEditing(ing)}>
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
