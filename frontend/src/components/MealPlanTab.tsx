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
    const [isLoadingMealPlan, setIsLoadingMealPlan] = useState<boolean>(true);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
    const [skipDays, setSkipDays] = useState<string[]>([]);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                setIsLoadingMealPlan(true);
                const [mealPlanRes, availableMealsRes] = await Promise.all([
                    fetch("/api/mealplan"),
                    fetch("/api/meals")
                ]);

                const [mealPlanData, availableMealsData] = await Promise.all([
                    mealPlanRes.json(),
                    availableMealsRes.json()
                ]);

                if (isMounted) {
                    setMealPlan(mealPlanData);
                    setAvailableMeals(availableMealsData);
                }
            } catch (err) {
                console.error("Error fetching meal plan or available meals:", err);
            } finally {
                if (isMounted) {
                    setIsLoadingMealPlan(false);
                }
            }
        };

        fetchData();

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

    const generateNewPlan = () => {
        setIsGeneratingPlan(true);
        fetch('/api/mealplan/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(skipDays.length ? { skip_days: skipDays } : {}),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to generate meal plan');
                }
                return response.json();
            })
            .then(data => {
                setMealPlan(data);
                setShoppingList([]);
                showToast('New meal plan generated!');
            })
            .catch(err => {
                console.error('Error generating meal plan:', err);
                showToast('Error generating new meal plan');
            })
            .finally(() => {
                setIsGeneratingPlan(false);
            });
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

        // Create an HTML table representation that will be properly recognized by Apple Notes
        let htmlContent = '<table style="border-collapse: collapse; width: 100%;">';

        // Add table header with styling
        htmlContent += `
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Day</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Meal</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Effort</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">URL</th>
            </tr>
          </thead>
          <tbody>
        `;

        // Add each day's meal information as table rows
        weekDays
            .filter(day => mealPlan[day])
            .forEach(day => {
                const meal = mealPlan[day];
                const url = meal.url || 'N/A';
                const urlDisplay = meal.url ?
                    `<a href="${meal.url}" style="color: #2196f3; text-decoration: underline;">${meal.url}</a>` :
                    'N/A';

                htmlContent += `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${day}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${meal.mealName}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${meal.relativeEffort}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${urlDisplay}</td>
                  </tr>
                `;
            });

        htmlContent += '</tbody></table>';

        // Also create a plain text fallback for applications that don't support HTML
        let textContent = 'Day | Meal | Effort | URL\n';
        textContent += '----|------|--------|----\n';

        weekDays
            .filter(day => mealPlan[day])
            .forEach(day => {
                const meal = mealPlan[day];
                textContent += `${day} | ${meal.mealName} | ${meal.relativeEffort} | ${meal.url || 'N/A'}\n`;
            });

        // Use the modern clipboard API to write both HTML and text formats
        // This makes both formats available so the receiving application can choose the best one
        try {
            const clipboardItem = new ClipboardItem({
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
                'text/plain': new Blob([textContent], { type: 'text/plain' })
            });

            navigator.clipboard.write([clipboardItem])
                .then(() => showToast('Meal plan copied to clipboard!'))
                .catch(err => {
                    console.error('Failed to copy formatted content:', err);
                    // Fall back to plain text if the enhanced version fails
                    navigator.clipboard.writeText(textContent)
                        .then(() => showToast('Meal plan copied to clipboard (plain text only)!'))
                        .catch(err => {
                            console.error('Failed to copy to clipboard:', err);
                            showToast('Failed to copy to clipboard');
                        });
                });
        } catch (error) {
            // Handle browsers that don't support ClipboardItem
            console.error('Advanced clipboard features not supported:', error);
            navigator.clipboard.writeText(textContent)
                .then(() => showToast('Meal plan copied to clipboard (basic format)!'))
                .catch(err => {
                    console.error('Failed to copy to clipboard:', err);
                    showToast('Failed to copy to clipboard');
                });
        }
    };

    return (
        <Box sx={{ p: 3 }} data-testid="meal-plan-component">
            <Typography variant="h4" gutterBottom>
                Weekly Meal Plan
            </Typography>
            {isLoadingMealPlan ? (
                <Typography>Loading meal plan...</Typography>
            ) : mealPlan ? (
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
                                                                open={process.env.NODE_ENV === 'test' ? true : undefined}
                                                            >
                                                                {(Array.isArray(availableMeals) ? availableMeals : [])
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
                <Typography>No meal plan available. Generate a new one to get started.</Typography>
            )}

            <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="skip-day-label">Skip Days</InputLabel>
                    <Select
                        labelId="skip-day-label"
                        multiple
                        value={skipDays}
                        label="Skip Days"
                        onChange={(e) => setSkipDays(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                        renderValue={(selected) => (selected as string[]).join(', ')}
                    >
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
                            <MenuItem key={day} value={day}>{day}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={generateNewPlan}
                    disabled={isGeneratingPlan}
                >
                    {isGeneratingPlan ? "Generating..." : "Generate New Plan"}
                </Button>
                <Button
                    variant="outlined"
                    onClick={finalizePlan}
                    disabled={!mealPlan}
                >
                    Finalize Meal Plan
                </Button>
                <Button
                    variant="outlined"
                    onClick={getShoppingList}
                    disabled={!mealPlan}
                >
                    Get Shopping List
                </Button>
                <Button
                    variant="outlined"
                    onClick={() => window.open('/api/mealplan/ics', '_blank')}
                    disabled={!mealPlan}
                >
                    Add to Google Calendar
                </Button>
            </Box>

            {shoppingList.length > 0 && (
                <>
                    {mealPlan && (
                        <Box sx={{ mt: 4, mb: 4, p: 3, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                            <Typography variant="h6" gutterBottom>Meal Plan Summary</Typography>
                            <Table sx={{ mb: 2 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Day</TableCell>
                                        <TableCell>Meal</TableCell>
                                        <TableCell>Effort</TableCell>
                                        <TableCell>URL</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                                        .filter(day => mealPlan[day])
                                        .map(day => (
                                            <TableRow key={day}>
                                                <TableCell>{day}</TableCell>
                                                <TableCell>{mealPlan[day].mealName}</TableCell>
                                                <TableCell>{mealPlan[day].relativeEffort}</TableCell>
                                                <TableCell>
                                                    {mealPlan[day].url ? (
                                                        <a href={mealPlan[day].url} target="_blank" rel="noopener noreferrer">
                                                            Link
                                                        </a>
                                                    ) : 'N/A'}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    }
                                </TableBody>
                            </Table>
                            <Button
                                variant="contained"
                                data-testid="copy-meal-plan"
                                onClick={copyMealPlanToClipboard}
                                sx={{ mt: 1 }}
                            >
                                Copy Meal Plan
                            </Button>
                        </Box>
                    )}

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
                </>
            )}
        </Box>
    );
}; 