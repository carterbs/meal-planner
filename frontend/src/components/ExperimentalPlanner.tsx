import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Paper,
    Typography,
    Alert,
    Autocomplete,
    TextField,
    Card,
    CardContent,
    Stack,
    Chip,
    Divider,
    Container
} from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import { Meal, Ingredient } from '../types';

// Day and MealType enums
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export interface MealSlot {
    day: Day;
    mealType: MealType;
    state: 'empty' | 'suggested' | 'planned' | 'skipped';
    meal?: Meal;
    previousState?: 'empty' | 'suggested' | 'planned';
}

const days: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const mealTypes: MealType[] = ['Breakfast', 'Lunch', 'Dinner'];

const dayToFull: Record<Day, string> = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday'
};

const createEmptyGrid = () => {
    const grid: Record<Day, Record<MealType, MealSlot>> = {} as any;
    days.forEach(d => {
        grid[d] = {} as any;
        mealTypes.forEach(mt => {
            grid[d][mt] = { day: d, mealType: mt, state: 'empty', previousState: undefined } as MealSlot;
        });
    });
    return grid;
};

interface MealCardProps {
    slot: MealSlot;
    onSkip: () => void;
    onReplace: (meal: Meal) => void;
    availableMeals: Meal[];
}

const MealCard: React.FC<MealCardProps> = ({ slot, onSkip, onReplace, availableMeals }) => {
    const [editing, setEditing] = useState(false);

    const handleSelect = (_: any, value: Meal | null) => {
        if (value) {
            onReplace(value);
        }
        setEditing(false);
    };

    const getMealDisplayName = () => {
        if (slot.state === 'skipped') return 'Skipped';
        return slot.meal?.mealName || `${slot.mealType} ${slot.day}`;
    };

    const getEffortLevel = () => {
        return slot.meal?.relativeEffort || 1;
    };

    return (
        <Box sx={{
            p: 2,
            borderLeft: '4px solid',
            borderColor: slot.state === 'skipped' ? 'grey.300' : 'success.main',
            borderRadius: 1,
            backgroundColor: 'rgba(245, 249, 242, 0.5)',
            display: 'grid',
            gridTemplateColumns: '80px 1fr auto',
            gap: 2,
            alignItems: 'center',
            opacity: slot.state === 'skipped' ? 0.6 : 1,
            transition: 'all 0.2s ease',
            '&:hover': {
                backgroundColor: 'rgba(242, 247, 239, 0.8)',
                transform: 'translateX(2px)'
            }
        }}>
            {/* Left section - Meal Type */}
            <Typography
                variant="body2"
                sx={{
                    fontWeight: 500,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.025em',
                    fontSize: '0.875rem'
                }}
            >
                {slot.mealType}
            </Typography>

            {/* Middle section - Meal Details */}
            <Box>
                {editing ? (
                    <Autocomplete
                        options={availableMeals}
                        getOptionLabel={(m) => m.mealName}
                        onChange={handleSelect}
                        size="small"
                        openOnFocus
                        disablePortal
                        renderInput={(params) =>
                            <TextField
                                {...params}
                                label="Choose meal"
                                data-testid={`replace-input-${slot.day}-${slot.mealType}`}
                                size="small"
                            />
                        }
                    />
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography
                            variant="body1"
                            sx={{
                                textDecoration: slot.state === 'skipped' ? 'line-through' : 'none',
                                color: slot.state === 'skipped' ? 'text.disabled' : '#4a5d3a',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                lineHeight: 1.4
                            }}
                            data-testid={`cell-${slot.day}-${slot.mealType}`}
                            data-state={slot.state}
                        >
                            {getMealDisplayName()}
                        </Typography>
                        {slot.state !== 'skipped' && (
                            <Typography
                                variant="body2"
                                sx={{
                                    fontSize: '0.75rem',
                                    color: '#8a9584'
                                }}
                            >
                                Effort: {getEffortLevel()}
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>

            {/* Right section - Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1 }}>
                {!editing && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setEditing(true)}
                        sx={{
                            fontSize: '0.75rem',
                            py: 0.75,
                            px: 1.5,
                            fontWeight: 500,
                            textTransform: 'none',
                            backgroundColor: 'rgba(240, 248, 237, 1)',
                            color: '#7fb069',
                            borderColor: '#c8dbb8',
                            '&:hover': {
                                backgroundColor: 'rgba(232, 244, 227, 1)',
                                borderColor: '#b0cc96',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 2px 8px rgba(127, 176, 105, 0.1)'
                            }
                        }}
                    >
                        Swap Meal
                    </Button>
                )}
                <Button
                    size="small"
                    variant="outlined"
                    onClick={onSkip}
                    data-testid={`skip-${slot.day}-${slot.mealType}`}
                    sx={{
                        fontSize: '0.75rem',
                        py: 0.75,
                        px: 1.5,
                        fontWeight: 500,
                        textTransform: 'none',
                        backgroundColor: 'rgba(254, 246, 240, 1)',
                        color: '#e09e60',
                        borderColor: '#f0c99b',
                        '&:hover': {
                            backgroundColor: 'rgba(253, 237, 224, 1)',
                            borderColor: '#eab680',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 2px 8px rgba(224, 158, 96, 0.1)'
                        }
                    }}
                >
                    {slot.state === 'skipped' ? 'Unskip' : 'Skip'}
                </Button>
            </Box>
        </Box>
    );
};

interface DayCardProps {
    day: Day;
    daySlots: Record<MealType, MealSlot>;
    onSkip: (mealType: MealType) => void;
    onReplace: (mealType: MealType, meal: Meal) => void;
    availableMeals: Meal[];
}

const DayCard: React.FC<DayCardProps> = ({ day, daySlots, onSkip, onReplace, availableMeals }) => {
    return (
        <Paper
            sx={{
                mb: 3,
                overflow: 'visible',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2
            }}
        >
            {/* Day Header */}
            <Box sx={{
                px: 3,
                py: 2,
                borderBottom: '2px solid',
                borderColor: 'success.main',
                backgroundColor: 'background.paper'
            }}>
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 600,
                        color: 'success.main',
                        m: 0,
                        fontSize: '1.25rem'
                    }}
                >
                    {dayToFull[day]}
                </Typography>
            </Box>

            {/* Meals */}
            <Box sx={{ p: 2.5, display: 'grid', gap: 2 }}>
                {mealTypes.map((mealType) => (
                    <MealCard
                        key={mealType}
                        slot={daySlots[mealType]}
                        onSkip={() => onSkip(mealType)}
                        onReplace={(meal) => onReplace(mealType, meal)}
                        availableMeals={availableMeals}
                    />
                ))}
            </Box>
        </Paper>
    );
};

export const ExperimentalPlanner: React.FC = () => {
    const [grid, setGrid] = useState<Record<Day, Record<MealType, MealSlot>>>(createEmptyGrid());
    const [availableMeals, setAvailableMeals] = useState<Meal[]>([]);
    const [shoppingList, setShoppingList] = useState<Ingredient[]>([]);
    const [listStale, setListStale] = useState(false);

    // Load from localStorage or generate on first mount
    useEffect(() => {
        const stored = localStorage.getItem('experimental-plan');
        if (stored) {
            try {
                setGrid(JSON.parse(stored));
                return;
            } catch {
                /* ignore */
            }
        }
        generateWeek();
    }, []);

    // fetch available meals
    useEffect(() => {
        fetch('/api/meals')
            .then(res => res.ok ? res.json() : [])
            .then(data => setAvailableMeals(Array.isArray(data) ? data : []))
            .catch(() => setAvailableMeals([]));
    }, []);

    // persist draft
    useEffect(() => {
        localStorage.setItem('experimental-plan', JSON.stringify(grid));
    }, [grid]);

    const dummyMeal = (day: Day, mealType: MealType): Meal => ({
        id: 0,
        mealName: `${mealType} ${day}`,
        relativeEffort: 1,
        lastPlanned: '',
        redMeat: false,
        mealType: mealType.toLowerCase() as any,
        ingredients: []
    });

    const generateWeek = async () => {
        const newGrid = createEmptyGrid();
        days.forEach(d => {
            newGrid[d]['Breakfast'] = { day: d, mealType: 'Breakfast', state: 'planned', meal: dummyMeal(d, 'Breakfast') };
            newGrid[d]['Lunch'] = { day: d, mealType: 'Lunch', state: 'planned', meal: dummyMeal(d, 'Lunch') };
        });

        try {
            const res = await fetch('/api/mealplan');
            if (res.ok) {
                const data: Record<string, Meal> = await res.json();
                days.forEach(d => {
                    const meal = data[dayToFull[d]];
                    if (meal) {
                        newGrid[d]['Dinner'] = { day: d, mealType: 'Dinner', state: 'suggested', meal };
                    } else {
                        newGrid[d]['Dinner'] = { day: d, mealType: 'Dinner', state: 'suggested', meal: dummyMeal(d, 'Dinner') };
                    }
                });
            } else {
                days.forEach(d => {
                    newGrid[d]['Dinner'] = { day: d, mealType: 'Dinner', state: 'suggested', meal: dummyMeal(d, 'Dinner') };
                });
            }
        } catch (err) {
            console.error('Failed to load meal plan', err);
            days.forEach(d => {
                newGrid[d]['Dinner'] = { day: d, mealType: 'Dinner', state: 'suggested', meal: dummyMeal(d, 'Dinner') };
            });
        }

        setGrid(newGrid);
        setShoppingList([]);
        setListStale(false);
    };

    const toggleSkip = (day: Day, mealType: MealType) => {
        setGrid(prev => {
            const slot = prev[day][mealType];
            if (slot.state === 'skipped') {
                const restore = slot.previousState ?? (slot.meal ? 'planned' : 'empty');
                return {
                    ...prev,
                    [day]: {
                        ...prev[day],
                        [mealType]: { ...slot, state: restore, previousState: undefined }
                    }
                };
            } else {
                return {
                    ...prev,
                    [day]: {
                        ...prev[day],
                        [mealType]: { ...slot, previousState: slot.state, state: 'skipped' }
                    }
                };
            }
        });
        if (shoppingList.length > 0) setListStale(true);
    };

    const generateShoppingList = () => {
        const list: Ingredient[] = [];
        days.forEach(d => {
            mealTypes.forEach(mt => {
                const slot = grid[d][mt];
                if ((slot.state === 'planned' || slot.state === 'suggested') && slot.meal) {
                    list.push(...slot.meal.ingredients);
                }
            });
        });
        setShoppingList(list);
        setListStale(false);
    };

    const replaceMeal = (day: Day, mealType: MealType, meal: Meal) => {
        setGrid(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [mealType]: { day, mealType, state: 'planned', meal }
            }
        }));
        if (shoppingList.length > 0) setListStale(true);
    };

    const finalizeMealPlan = () => {
        // Placeholder for finalize functionality
        console.log('Finalizing meal plan...');
    };

    const addToGoogleCalendar = () => {
        // Placeholder for Google Calendar integration
        console.log('Adding to Google Calendar...');
    };

    return (
        <Container maxWidth="lg" data-testid="experimental-planner">
            {/* Header Section */}
            <Box sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                p: 4,
                borderRadius: 2,
                mb: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 2
            }}>
                <RestaurantMenuIcon sx={{ fontSize: 40 }} />
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                        Weekly Meal Plan
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9 }}>
                        Plan your meals for the week ahead
                    </Typography>
                </Box>
            </Box>

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                <Button
                    variant="contained"
                    size="large"
                    onClick={generateWeek}
                    sx={{ px: 3 }}
                >
                    Generate New Plan
                </Button>
                <Button
                    variant="outlined"
                    size="large"
                    onClick={finalizeMealPlan}
                    sx={{ px: 3 }}
                >
                    Finalize Meal Plan
                </Button>
                <Button
                    variant="outlined"
                    size="large"
                    onClick={addToGoogleCalendar}
                    sx={{ px: 3 }}
                >
                    Add to Google Calendar
                </Button>
            </Stack>

            {/* Alert for stale shopping list */}
            {listStale && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Shopping list out of date — regenerate?
                </Alert>
            )}

            {/* Days Grid */}
            <Box sx={{ mb: 4 }}>
                {days.map(day => (
                    <DayCard
                        key={day}
                        day={day}
                        daySlots={grid[day]}
                        onSkip={(mealType) => toggleSkip(day, mealType)}
                        onReplace={(mealType, meal) => replaceMeal(day, mealType, meal)}
                        availableMeals={availableMeals}
                    />
                ))}
            </Box>

            {/* Additional Actions */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Button variant="outlined" onClick={generateShoppingList}>
                    Generate Shopping List
                </Button>
            </Box>

            {/* Shopping List */}
            {shoppingList.length > 0 && (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Shopping List</Typography>
                    <Box component="ul" sx={{ m: 0, pl: 3 }}>
                        {shoppingList.map((ingredient, idx) => (
                            <Typography component="li" key={idx} sx={{ mb: 0.5 }}>
                                {ingredient.Name}
                            </Typography>
                        ))}
                    </Box>
                </Paper>
            )}
        </Container>
    );
};
