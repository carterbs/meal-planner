import React, { useEffect, useState } from "react";
import { MealPlan, Meal, Ingredient } from "../types";
import {
    Box,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Button,
    Paper,
    List,
    ListItem,
    ListItemText
} from "@mui/material";

interface MealPlanTabProps {
    showToast: (message: string) => void;
}

export const MealPlanTab: React.FC<MealPlanTabProps> = ({ showToast }) => {
    const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
    const [shoppingList, setShoppingList] = useState<Ingredient[]>([]);

    useEffect(() => {
        fetch("/api/mealplan")
            .then((res) => res.json())
            .then((data: MealPlan) => setMealPlan(data))
            .catch((err) => console.error("Error fetching meal plan:", err));
    }, []);

    const finalizePlan = () => {
        fetch("/api/mealplan/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: {} })
        })
            .then((res) => res.text())
            .then((text) => alert(text))
            .catch((err) => console.error("Error finalizing plan:", err));
    };

    const swapMeal = (day: string) => {
        const currentMeal = mealPlan ? mealPlan[day] : null;
        if (!currentMeal) return;
        fetch("/api/meals/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meal_id: currentMeal.id }),
        })
            .then((res) => res.json())
            .then((newMeal: Meal) => {
                setMealPlan({ ...mealPlan, [day]: newMeal });
                setShoppingList([]);
                showToast(`Swapped ${day} with: ${newMeal.mealName} (ID: ${newMeal.id})`);
            })
            .catch((err) => console.error("Error swapping meal:", err));
    };

    const getShoppingList = () => {
        if (!mealPlan) return;
        const mealIDs = Object.values(mealPlan).map((meal) => meal.id);
        fetch("/api/shoppinglist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: mealIDs }),
        })
            .then((res) => res.json())
            .then((data: Ingredient[]) => setShoppingList(data))
            .catch((err) => console.error(err));
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h4" gutterBottom>
                Weekly Meal Plan
            </Typography>
            {mealPlan ? (
                <Paper variant="outlined">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Day</TableCell>
                                <TableCell>Meal</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(mealPlan).map(([day, meal]) => (
                                <TableRow key={day}>
                                    <TableCell>{day}</TableCell>
                                    <TableCell>{meal.mealName}</TableCell>
                                    <TableCell>
                                        {day !== "Friday" && meal.mealName !== "Eating out" && (
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                size="small"
                                                onClick={() => swapMeal(day)}
                                            >
                                                Swap Meal
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            ) : (
                <Typography>Loading meal plan...</Typography>
            )}

            <Box sx={{ mt: 2 }}>
                <Button variant="outlined" onClick={finalizePlan}>
                    Finalize Meal Plan
                </Button>
                <Button variant="outlined" onClick={getShoppingList} sx={{ ml: 2 }}>
                    Get Shopping List
                </Button>
            </Box>

            {shoppingList.length > 0 && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="h5" gutterBottom>
                        Shopping List
                    </Typography>
                    <List>
                        {shoppingList.map((item, index) => (
                            <ListItem key={index}>
                                <ListItemText
                                    primary={`${item.Quantity} ${item.Unit} ${item.Name}`} />

                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}
        </Box>
    );
}; 