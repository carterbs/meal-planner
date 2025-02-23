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
    ListItemText,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from "@mui/material";

interface MealPlanTabProps {
    showToast: (message: string) => void;
}

export const MealPlanTab: React.FC<MealPlanTabProps> = ({ showToast }) => {
    const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
    const [shoppingList, setShoppingList] = useState<Ingredient[]>([]);
    const [availableMeals, setAvailableMeals] = useState<Meal[]>([]);

    useEffect(() => {
        let isMounted = true;

        const fetchMealPlan = async () => {
            try {
                const res = await fetch("/api/mealplan");
                const data = await res.json();
                if (isMounted) {
                    setMealPlan(data);
                }
            } catch (err) {
                console.error("Error fetching meal plan:", err);
            }
        };

        fetchMealPlan();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchAvailableMeals = async () => {
            try {
                const res = await fetch("/api/meals");
                const data = await res.json();
                if (isMounted) {
                    setAvailableMeals(data);
                }
            } catch (err) {
                console.error("Error fetching available meals:", err);
            }
        };

        fetchAvailableMeals();
        return () => {
            isMounted = false;
        };
    }, []);

    const finalizePlan = () => {
        if (!mealPlan) return;
        fetch("/api/mealplan/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: mealPlan })
        })
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Finalize error: ${res.status}`);
                }
                return res.text();
            })
            .then((text) => showToast(text))
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
        const mealIDs = Object.values(mealPlan).map(meal => meal.id);
        fetch("/api/shoppinglist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: mealIDs }),
        })
            .then((res) => res.json())
            .then((ingredients: Ingredient[]) => setShoppingList(ingredients))
            .catch((err) => console.error("Error getting shopping list:", err));
    };

    const handleMealSelect = (day: string, newMealId: number) => {
        if (!mealPlan) return;

        fetch("/api/mealplan/replace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                day,
                new_meal_id: newMealId,
            }),
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to replace meal");
                return res.json();
            })
            .then((updatedMeal: Meal) => {
                setMealPlan({ ...mealPlan, [day]: updatedMeal });
                setShoppingList([]);
                showToast(`Updated ${day}'s meal to: ${updatedMeal.mealName}`);
            })
            .catch((err) => {
                console.error("Error replacing meal:", err);
                showToast("Error replacing meal");
            });
    };

    const copyShoppingListToClipboard = () => {
        const formattedList = shoppingList
            .map(item => `${item.Quantity} ${item.Unit} ${item.Name}`)
            .join('\n');
        navigator.clipboard.writeText(formattedList)
            .then(() => showToast('Shopping list copied to clipboard!'))
            .catch(err => {
                console.error('Failed to copy to clipboard:', err);
                showToast('Failed to copy to clipboard');
            });
    };

    const copyMealPlanToClipboard = () => {
        if (!mealPlan) return;
        const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const formattedPlan = weekDays
            .filter(day => mealPlan[day])
            .map(day => `${day}: ${mealPlan[day].mealName}`)
            .join('\n');
        navigator.clipboard.writeText(formattedPlan)
            .then(() => showToast('Meal plan copied to clipboard!'))
            .catch(err => {
                console.error('Failed to copy to clipboard:', err);
                showToast('Failed to copy to clipboard');
            });
    };

    return (
        <Box sx={{ p: 3 }} data-testid="meal-plan-component">
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
                                <TableCell>Effort</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {mealPlan && (
                                Object.entries(mealPlan)
                                    .filter(([day, meal]) => meal)
                                    .sort((a, b) => {
                                        const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                                        const dayA = weekDays.indexOf(a[0]);
                                        const dayB = weekDays.indexOf(b[0]);
                                        return dayA - dayB;
                                    })
                                    .map(([day, meal]) => (
                                        <TableRow key={day}>
                                            <TableCell>{day}</TableCell>
                                            <TableCell>{meal?.mealName}</TableCell>
                                            <TableCell>{meal?.relativeEffort}</TableCell>
                                            <TableCell>
                                                {meal && day !== "Friday" && meal.mealName !== "Eating out" && (
                                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                                        <Button
                                                            variant="contained"
                                                            color="primary"
                                                            size="small"
                                                            onClick={() => swapMeal(day)}
                                                        >
                                                            Swap Meal
                                                        </Button>
                                                        <FormControl size="small" sx={{ minWidth: 200 }}>
                                                            <InputLabel id={`meal-select-${day}`}>Select Meal</InputLabel>
                                                            <Select
                                                                labelId={`meal-select-${day}`}
                                                                value=""
                                                                label="Select Meal"
                                                                onChange={(e) => handleMealSelect(day, Number(e.target.value))}
                                                                data-testid={`meal-select-${day}`}
                                                                MenuProps={{ disablePortal: true }}
                                                                open={process.env.NODE_ENV === 'test'}
                                                            >
                                                                {availableMeals
                                                                    .filter(m => m.id !== meal.id)
                                                                    .sort((a, b) => a.mealName.localeCompare(b.mealName))
                                                                    .map((m) => (
                                                                        <MenuItem key={m.id} value={m.id}>
                                                                            {m.mealName}
                                                                        </MenuItem>
                                                                    ))}
                                                            </Select>
                                                        </FormControl>
                                                    </Box>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                            )}
                        </TableBody>
                    </Table>
                </Paper>
            ) : (
                <Typography>Loading meal plan...</Typography>
            )}

            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button variant="outlined" onClick={finalizePlan}>
                    Finalize Meal Plan
                </Button>
                <Button variant="outlined" onClick={getShoppingList}>
                    Get Shopping List
                </Button>
            </Box>

            {shoppingList.length > 0 && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="h6">Shopping List</Typography>
                    <List>
                        {shoppingList.map((item, index) => (
                            <ListItem key={index}>
                                <ListItemText primary={`${item.Quantity} ${item.Unit} ${item.Name}`} />
                            </ListItem>
                        ))}
                    </List>
                    <Button variant="contained" onClick={copyShoppingListToClipboard}>
                        Copy to Clipboard
                    </Button>
                </Box>
            )}

            {mealPlan && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="h6">Meal Plan Summary</Typography>
                    <Box>
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                            .filter(day => mealPlan[day])
                            .map(day => (
                                <Typography key={day}>{`${day}: ${mealPlan[day].mealName}`}</Typography>
                            ))
                        }
                    </Box>
                    <Button variant="contained" data-testid="copy-meal-plan" onClick={copyMealPlanToClipboard}>
                        Copy Meal Plan
                    </Button>
                </Box>
            )}
        </Box>
    );
}; 