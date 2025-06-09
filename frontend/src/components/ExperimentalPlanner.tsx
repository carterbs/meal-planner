import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography, Alert } from '@mui/material';
import { Meal, Ingredient } from '../types';

// Day and MealType enums
export type Day = 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';
export type MealType = 'Breakfast'|'Lunch'|'Dinner';

export interface MealSlot {
    day: Day;
    mealType: MealType;
    state: 'empty'|'suggested'|'planned'|'skipped';
    meal?: Meal;
}

const days: Day[] = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const mealTypes: MealType[] = ['Breakfast','Lunch','Dinner'];

const createEmptyGrid = () => {
    const grid: Record<Day, Record<MealType, MealSlot>> = {} as any;
    days.forEach(d => {
        grid[d] = {} as any;
        mealTypes.forEach(mt => {
            grid[d][mt] = { day: d, mealType: mt, state: 'empty' };
        });
    });
    return grid;
};

export const ExperimentalPlanner: React.FC = () => {
    const [grid, setGrid] = useState<Record<Day, Record<MealType, MealSlot>>>(createEmptyGrid());
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

    const dayToFull: Record<Day, string> = {
        Mon: 'Monday',
        Tue: 'Tuesday',
        Wed: 'Wednesday',
        Thu: 'Thursday',
        Fri: 'Friday',
        Sat: 'Saturday',
        Sun: 'Sunday'
    };

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
                        newGrid[d]['Dinner'] = { day: d, mealType: 'Dinner', state: 'planned', meal };
                    } else {
                        newGrid[d]['Dinner'] = { day: d, mealType: 'Dinner', state: 'empty' };
                    }
                });
            } else {
                days.forEach(d => {
                    newGrid[d]['Dinner'] = { day: d, mealType: 'Dinner', state: 'planned', meal: dummyMeal(d, 'Dinner') };
                });
            }
        } catch (err) {
            console.error('Failed to load meal plan', err);
            days.forEach(d => {
                newGrid[d]['Dinner'] = { day: d, mealType: 'Dinner', state: 'planned', meal: dummyMeal(d, 'Dinner') };
            });
        }

        setGrid(newGrid);
        setShoppingList([]);
        setListStale(false);
    };

    const toggleSkip = (day: Day, mealType: MealType) => {
        setGrid(prev => {
            const slot = prev[day][mealType];
            const newState = slot.state === 'skipped' ? 'empty' : 'skipped';
            return { ...prev, [day]: { ...prev[day], [mealType]: { ...slot, state: newState } } };
        });
        if (shoppingList.length > 0) setListStale(true);
    };

    const generateShoppingList = () => {
        const list: Ingredient[] = [];
        days.forEach(d => {
            mealTypes.forEach(mt => {
                const slot = grid[d][mt];
                if (slot.state === 'planned' && slot.meal) {
                    list.push(...slot.meal.ingredients);
                }
            });
        });
        setShoppingList(list);
        setListStale(false);
    };

    return (
        <Box sx={{ p: 3 }} data-testid="experimental-planner">
            <Typography variant="h4" gutterBottom>Experimental Planner</Typography>
            {listStale && (
                <Alert severity="warning">Shopping list out of date — regenerate?</Alert>
            )}
            <Paper>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell></TableCell>
                            {days.map(day => (
                                <TableCell key={day} data-testid={`header-${day}`}>{day}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {mealTypes.map(mt => (
                            <TableRow key={mt} sx={{ backgroundColor: mt === 'Lunch' ? 'rgba(0,0,0,0.02)' : undefined }}>
                                <TableCell component="th" scope="row">{mt}</TableCell>
                                {days.map(day => {
                                    const slot = grid[day][mt];
                                    let content: React.ReactNode = null;
                                    if (slot.state === 'skipped') {
                                        content = <span style={{ textDecoration: 'line-through' }}>Skipped</span>;
                                    } else if (slot.state === 'planned') {
                                        content = slot.meal?.mealName || 'Planned';
                                    }
                                    return (
                                        <TableCell key={day+mt} data-testid={`cell-${day}-${mt}`}>
                                            {content}
                                            <Button size="small" onClick={() => toggleSkip(day, mt)}>
                                                {slot.state === 'skipped' ? 'Unskip' : 'Skip'}
                                            </Button>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
            <Box sx={{ mt: 2, display:'flex', gap:2 }}>
                <Button variant="contained" onClick={generateWeek}>Generate Week</Button>
                <Button variant="outlined" onClick={generateShoppingList}>Generate Shopping List</Button>
            </Box>
            {shoppingList.length > 0 && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="h6">Shopping List</Typography>
                    <ul>
                        {shoppingList.map((i, idx) => <li key={idx}>{i.Name}</li>)}
                    </ul>
                </Box>
            )}
        </Box>
    );
};
