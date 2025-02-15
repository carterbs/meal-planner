import React, { useEffect, useState } from "react";
import { Meal } from "../types";
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
    CardContent
} from "@mui/material";

interface MealManagementTabProps {
    showToast: (message: string) => void;
}

export const MealManagementTab: React.FC<MealManagementTabProps> = ({ showToast }) => {
    const [meals, setMeals] = useState<Meal[]>([]);
    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

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
                            <List>
                                {meals.map((meal) => (
                                    <ListItem key={meal.id} disablePadding>
                                        <ListItemButton
                                            selected={selectedMeal?.id === meal.id}
                                            onClick={() => setSelectedMeal(meal)}
                                        >
                                            <ListItemText primary={meal.mealName} />
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
                                <Typography variant="h6" sx={{ mt: 2 }}>
                                    Ingredients
                                </Typography>
                                {selectedMeal.ingredients.length === 0 ? (
                                    <Typography>No ingredients found.</Typography>
                                ) : (
                                    <List>
                                        {selectedMeal.ingredients.map((ing, index) => (
                                            <ListItem key={index}>
                                                <ListItemText
                                                    primary={`${ing.Quantity} ${ing.Unit} ${ing.Name}`}
                                                />
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