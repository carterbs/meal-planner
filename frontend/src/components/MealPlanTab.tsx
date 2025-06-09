import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CircularProgress,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

import { Meal, Ingredient } from '../types';

interface MealPlanTabProps {
    showToast: (message: string) => void;
}

// Define meal types for each day
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface ExtendedMealPlan {
    [day: string]: {
        [mealType: string]: Meal | null;
    };
}

export const MealPlanTab: React.FC<MealPlanTabProps> = ({ showToast }) => {
    const [mealPlan, setMealPlan] = useState<ExtendedMealPlan | null>(null);
    const [shoppingList, setShoppingList] = useState<Ingredient[]>([]);
    const [availableMeals, setAvailableMeals] = useState<Meal[]>([]);
    const [isLoadingMealPlan, setIsLoadingMealPlan] = useState<boolean>(true);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
    const [isLoadingShoppingList, setIsLoadingShoppingList] = useState<boolean>(false);
    const [shoppingListError, setShoppingListError] = useState<string | null>(null);
    const [skipDays, setSkipDays] = useState<string[]>([]);
    const [skippedMeals, setSkippedMeals] = useState<Set<string>>(new Set());

    // Debounced shopping list generation function
    const generateShoppingListAutomatic = useCallback(async () => {
        if (!mealPlan) return;

        // Get all non-skipped meals
        const mealIDs: number[] = [];
        WEEK_DAYS.forEach(day => {
            MEAL_TYPES.forEach(mealType => {
                const meal = mealPlan[day][mealType];
                const mealKey = `${day}-${mealType}`;
                if (meal && !skippedMeals.has(mealKey)) {
                    mealIDs.push(meal.id);
                }
            });
        });

        // Don't generate shopping list if no meals are planned
        if (mealIDs.length === 0) {
            setShoppingList([]);
            setShoppingListError(null);
            return;
        }

        setIsLoadingShoppingList(true);
        setShoppingListError(null);

        try {
            const response = await fetch("/api/shoppinglist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan: mealIDs }),
            });

            if (!response.ok) {
                throw new Error(`Failed to generate shopping list: ${response.status}`);
            }

            const ingredients: Ingredient[] = await response.json();
            setShoppingList(ingredients);
        } catch (err) {
            console.error("Error getting shopping list:", err);
            setShoppingListError("Failed to generate shopping list");
            setShoppingList([]);
        } finally {
            setIsLoadingShoppingList(false);
        }
    }, [mealPlan, skippedMeals]);

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
                    // Transform the old meal plan format to new extended format
                    const extendedMealPlan: ExtendedMealPlan = {};
                    WEEK_DAYS.forEach(day => {
                        extendedMealPlan[day] = {
                            Breakfast: mealPlanData[day] ? {
                                ...mealPlanData[day],
                                mealName: `Breakfast ${day.slice(0, 3)}`,
                                relativeEffort: 1
                            } : null,
                            Lunch: mealPlanData[day] ? {
                                ...mealPlanData[day],
                                mealName: `Lunch ${day.slice(0, 3)}`,
                                relativeEffort: 2
                            } : null,
                            Dinner: mealPlanData[day] || null,
                        };
                    });

                    setMealPlan(extendedMealPlan);
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

    // Auto-generate shopping list when meal plan or skipped meals change
    useEffect(() => {
        if (mealPlan && !isLoadingMealPlan) {
            generateShoppingListAutomatic();
        }
    }, [mealPlan, generateShoppingListAutomatic, isLoadingMealPlan]);

    const finalizePlan = () => {
        if (!mealPlan) return;

        // Convert back to old format for API compatibility
        const oldFormat: { [day: string]: Meal } = {};
        WEEK_DAYS.forEach(day => {
            if (mealPlan[day]?.Dinner) {
                oldFormat[day] = mealPlan[day].Dinner!;
            }
        });

        fetch("/api/mealplan/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: oldFormat })
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
                // Transform new data to extended format
                const extendedMealPlan: ExtendedMealPlan = {};
                WEEK_DAYS.forEach(day => {
                    extendedMealPlan[day] = {
                        Breakfast: data[day] ? {
                            ...data[day],
                            mealName: `Breakfast ${day.slice(0, 3)}`,
                            relativeEffort: 1
                        } : null,
                        Lunch: data[day] ? {
                            ...data[day],
                            mealName: `Lunch ${day.slice(0, 3)}`,
                            relativeEffort: 2
                        } : null,
                        Dinner: data[day] || null,
                    };
                });

                setMealPlan(extendedMealPlan);
                setShoppingList([]);
                setSkippedMeals(new Set());
                showToast('New meal plan generated!');
                // Shopping list will be auto-generated via useEffect
            })
            .catch(err => {
                console.error('Error generating meal plan:', err);
                showToast('Error generating new meal plan');
            })
            .finally(() => {
                setIsGeneratingPlan(false);
            });
    };

    const swapMeal = (day: string, mealType: string) => {
        const currentMeal = mealPlan?.[day]?.[mealType];
        if (!currentMeal) return;

        fetch("/api/meals/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meal_id: currentMeal.id }),
        })
            .then((res) => res.json())
            .then((newMeal: Meal) => {
                if (mealPlan) {
                    const updatedPlan = { ...mealPlan };
                    updatedPlan[day][mealType] = newMeal;
                    setMealPlan(updatedPlan);
                    showToast(`Swapped ${day} ${mealType} with: ${newMeal.mealName}`);
                    // Shopping list will be auto-updated via useEffect
                }
            })
            .catch((err) => console.error("Error swapping meal:", err));
    };

    const toggleSkipMeal = (day: string, mealType: string) => {
        const mealKey = `${day}-${mealType}`;
        const newSkippedMeals = new Set(skippedMeals);

        if (skippedMeals.has(mealKey)) {
            newSkippedMeals.delete(mealKey);
            showToast(`Unskipped ${day} ${mealType}`);
        } else {
            newSkippedMeals.add(mealKey);
            showToast(`Skipped ${day} ${mealType}`);
        }

        setSkippedMeals(newSkippedMeals);
    };

    const copyShoppingListToClipboard = () => {
        const formattedList = shoppingList
            .map(item => `${item.Quantity > 0 ? `${item.Quantity} ${item.Unit} ` : ''}${item.Name}`)
            .join('\n');
        navigator.clipboard.writeText(formattedList)
            .then(() => showToast('Shopping list copied to clipboard!'))
            .catch(err => {
                console.error('Failed to copy to clipboard:', err);
                showToast('Failed to copy to clipboard');
            });
    };

    const renderMealSlot = (day: string, mealType: string, meal: Meal | null) => {
        const mealKey = `${day}-${mealType}`;
        const isSkipped = skippedMeals.has(mealKey);

        return (
            <Box
                key={mealType}
                sx={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr auto',
                    gap: 2,
                    alignItems: 'center',
                    padding: 2,
                    background: 'linear-gradient(135deg, #f5f9f2 0%, #eff6ec 100%)',
                    borderRadius: 1,
                    borderLeft: '4px solid transparent',
                    borderImage: 'linear-gradient(135deg, #7fb069 0%, #1b998b 100%) 1',
                    transition: 'all 0.2s ease',
                    opacity: isSkipped ? 0.6 : 1,
                    '&:hover': {
                        background: 'linear-gradient(135deg, #f2f7ef 0%, #eef4eb 100%)',
                        transform: 'translateX(2px)',
                    },
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em',
                    }}
                >
                    {mealType}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography
                        variant="mealName"
                        sx={{
                            textDecoration: isSkipped ? 'line-through' : 'none',
                            color: isSkipped ? '#8a9584' : '#4a5d3a',
                        }}
                    >
                        {meal?.mealName || `${mealType} ${day.slice(0, 3)}`}
                    </Typography>
                    <Typography variant="mealEffort">
                        Effort: {meal?.relativeEffort || 1}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        onClick={() => swapMeal(day, mealType)}
                        disabled={!meal}
                        sx={{
                            padding: '6px 12px',
                            border: '1px solid #e8f0e5',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: 'linear-gradient(135deg, #f0f8ed 0%, #f5faf2 100%)',
                            color: '#7fb069',
                            borderColor: '#c8dbb8',
                            textTransform: 'none',
                            minWidth: 'auto',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #e8f4e3 0%, #f0f8ed 100%)',
                                borderColor: '#b0cc96',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 2px 8px rgba(127, 176, 105, 0.1)',
                            },
                        }}
                    >
                        Swap Meal
                    </Button>
                    <Button
                        size="small"
                        onClick={() => toggleSkipMeal(day, mealType)}
                        sx={{
                            padding: '6px 12px',
                            border: '1px solid #e8f0e5',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: isSkipped
                                ? 'linear-gradient(135deg, #f0f8ed 0%, #f5faf2 100%)'
                                : 'linear-gradient(135deg, #fef6f0 0%, #fcf1e8 100%)',
                            color: isSkipped ? '#7fb069' : '#e09e60',
                            borderColor: isSkipped ? '#c8dbb8' : '#f0c99b',
                            textTransform: 'none',
                            minWidth: 'auto',
                            '&:hover': {
                                background: isSkipped
                                    ? 'linear-gradient(135deg, #e8f4e3 0%, #f0f8ed 100%)'
                                    : 'linear-gradient(135deg, #fdede0 0%, #fef6f0 100%)',
                                borderColor: isSkipped ? '#b0cc96' : '#eab680',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 2px 8px rgba(127, 176, 105, 0.1)',
                            },
                        }}
                    >
                        {isSkipped ? 'Unskip' : 'Skip'}
                    </Button>
                </Box>
            </Box>
        );
    };

    if (isLoadingMealPlan) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, flexDirection: 'column', gap: 2 }}>
                <CircularProgress sx={{ color: '#7fb069' }} />
                <Typography variant="body1" sx={{ color: '#6b7668' }}>
                    Loading meal plan...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Controls Section */}
            <Box
                sx={{
                    padding: '25px 40px',
                    backgroundColor: 'white',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    flexWrap: 'wrap',
                }}
            >
                <Box sx={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        onClick={generateNewPlan}
                        disabled={isGeneratingPlan}
                        startIcon={isGeneratingPlan ? <CircularProgress size={16} color="inherit" /> : <RestaurantIcon />}
                        sx={{
                            background: 'linear-gradient(135deg, #7fb069 0%, #1b998b 100%)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #6fa055 0%, #178a7a 100%)',
                            },
                        }}
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
                </Box>
                <Box sx={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Button
                        variant="outlined"
                        onClick={() => window.open('http://localhost:8080/api/mealplan/ics', '_blank')}
                        disabled={!mealPlan}
                        startIcon={<CalendarTodayIcon />}
                    >
                        Add to Google Calendar
                    </Button>
                </Box>
            </Box>

            {/* Calendar Grid */}
            <Box sx={{ padding: '40px', backgroundColor: 'white', flex: 1 }}>
                {!mealPlan ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="h5" sx={{ color: '#6b7668', mb: 2 }}>
                            No meal plan available
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#8a9584', mb: 4 }}>
                            Generate a new one to get started
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={generateNewPlan}
                            disabled={isGeneratingPlan}
                            startIcon={<RestaurantIcon />}
                        >
                            Generate New Plan
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ display: 'grid', gap: '20px' }}>
                        {WEEK_DAYS.map(day => (
                            <Card
                                key={day}
                                sx={{
                                    background: 'linear-gradient(135deg, #fefffe 0%, #fbfef9 100%)',
                                    border: '1px solid #e8f0e5',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 15px rgba(127, 176, 105, 0.08)',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 8px 25px rgba(127, 176, 105, 0.15)',
                                    },
                                }}
                            >
                                {/* Day Header */}
                                <Box
                                    sx={{
                                        background: 'linear-gradient(135deg, #fafcf8 0%, #f6faf3 100%)',
                                        padding: '16px 20px',
                                        borderBottom: '1px solid #e8f0e5',
                                        position: 'relative',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: '3px',
                                            background: 'linear-gradient(90deg, #7fb069 0%, #1b998b 100%)',
                                        },
                                    }}
                                >
                                    <Typography variant="dayHeader">
                                        {day}
                                    </Typography>
                                </Box>

                                {/* Meal Slots */}
                                <Box sx={{ padding: '20px', display: 'grid', gap: '16px' }}>
                                    {MEAL_TYPES.map(mealType =>
                                        renderMealSlot(day, mealType, mealPlan[day][mealType])
                                    )}
                                </Box>
                            </Card>
                        ))}
                    </Box>
                )}

                {/* Shopping List Section */}
                {mealPlan && (
                    <Box
                        sx={{
                            marginTop: '30px',
                            padding: '25px',
                            background: 'linear-gradient(135deg, #f6faf3 0%, #f2f7ef 100%)',
                            borderRadius: '12px',
                            border: '1px solid #e8f0e5',
                            boxShadow: '0 4px 15px rgba(127, 176, 105, 0.05)',
                        }}
                    >
                        <Typography
                            variant="h5"
                            sx={{
                                color: '#4a5d3a',
                                marginBottom: '15px',
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            Shopping List
                            {isLoadingShoppingList && (
                                <CircularProgress size={16} sx={{ color: '#7fb069' }} />
                            )}
                        </Typography>

                        {shoppingListError && (
                            <Typography
                                variant="body2"
                                sx={{
                                    color: '#d32f2f',
                                    marginBottom: '15px',
                                    padding: '10px',
                                    backgroundColor: '#ffebee',
                                    borderRadius: '6px',
                                    border: '1px solid #ffcdd2',
                                }}
                            >
                                {shoppingListError}
                            </Typography>
                        )}

                        {!isLoadingShoppingList && !shoppingListError && shoppingList.length === 0 && (
                            <Typography
                                variant="body2"
                                sx={{
                                    color: '#8a9584',
                                    fontStyle: 'italic',
                                    marginBottom: '15px',
                                }}
                            >
                                No ingredients needed - add some meals to your plan!
                            </Typography>
                        )}

                        {shoppingList.length > 0 && (
                            <>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                        gap: '10px',
                                        marginBottom: '20px',
                                    }}
                                >
                                    {shoppingList.map((item, index) => (
                                        <Box
                                            key={index}
                                            sx={{
                                                background: 'linear-gradient(135deg, #fefffe 0%, #fafcf8 100%)',
                                                padding: '10px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.875rem',
                                                border: '1px solid #e8f0e5',
                                                color: '#6b7668',
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                    background: 'linear-gradient(135deg, #fafcf8 0%, #f6faf3 100%)',
                                                    transform: 'translateY(-1px)',
                                                    boxShadow: '0 2px 8px rgba(127, 176, 105, 0.08)',
                                                },
                                            }}
                                        >
                                            {`${item.Quantity > 0 ? `${item.Quantity} ${item.Unit} ` : ''}${item.Name}`}
                                        </Box>
                                    ))}
                                </Box>
                                <Button
                                    variant="contained"
                                    onClick={copyShoppingListToClipboard}
                                    startIcon={<ShoppingCartIcon />}
                                    disabled={isLoadingShoppingList}
                                >
                                    Copy to Clipboard
                                </Button>
                            </>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}; 