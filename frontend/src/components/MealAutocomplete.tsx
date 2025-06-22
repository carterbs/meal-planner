import React, { useState, useEffect } from 'react';
import {
    Autocomplete,
    TextField,
    Box,
    Typography,
    Chip,
    CircularProgress,
} from '@mui/material';
import { Meal } from '../types';

interface MealAutocompleteProps {
    value: Meal | null;
    onChange: (meal: Meal | null) => void;
    mealType: string;
    disabled?: boolean;
    placeholder?: string;
}

export const MealAutocomplete: React.FC<MealAutocompleteProps> = ({
    value,
    onChange,
    mealType,
    disabled = false,
    placeholder = "Search for a meal...",
}) => {
    const [availableMeals, setAvailableMeals] = useState<Meal[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [inputValue, setInputValue] = useState<string>('');

    // Fetch available meals when component mounts or mealType changes
    useEffect(() => {
        const fetchMeals = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/meals?type=${mealType.toLowerCase()}`);
                if (response.ok) {
                    const meals: Meal[] = await response.json();
                    setAvailableMeals(Array.isArray(meals) ? meals : []);
                } else {
                    setAvailableMeals([]);
                    console.error('Failed to fetch meals');
                }
            } catch (error) {
                setAvailableMeals([]);
                console.error('Error fetching meals:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMeals();
    }, [mealType]);

    // Update input value when value prop changes
    useEffect(() => {
        if (value) {
            setInputValue(value.mealName);
        } else {
            setInputValue('');
        }
    }, [value]);

    return (
        <Autocomplete
            value={value}
            onChange={(_, newValue) => onChange(newValue)}
            inputValue={inputValue}
            onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
            options={availableMeals}
            getOptionLabel={(option) => option.mealName}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={loading}
            disabled={disabled}
            filterOptions={(options, { inputValue }) => {
                // Custom filtering for better search experience
                const filterValue = inputValue.toLowerCase();
                return options.filter(option =>
                    option.mealName.toLowerCase().includes(filterValue)
                );
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={placeholder}
                    variant="outlined"
                    size="small"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            '& fieldset': {
                                borderColor: '#e8f0e5',
                            },
                            '&:hover fieldset': {
                                borderColor: '#c8dbb8',
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: '#7fb069',
                            },
                        },
                    }}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                />
            )}
            renderOption={(props, option) => {
    const { key, ...rest } = props;
    return (
        <Box component="li" key={key} {...rest}>
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {option.mealName}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                    <Chip
                        label={`Effort: ${option.relativeEffort}`}
                        size="small"
                        sx={{
                            height: '20px',
                            fontSize: '0.7rem',
                            backgroundColor: '#f0f8ed',
                            color: '#7fb069',
                        }}
                    />
                    {option.redMeat && (
                        <Chip
                            label="Red Meat"
                            size="small"
                            sx={{
                                height: '20px',
                                fontSize: '0.7rem',
                                backgroundColor: '#fef6f0',
                                color: '#e09e60',
                            }}
                        />
                    )}
                    {option.url && (
                        <Chip
                            label="Has Recipe"
                            size="small"
                            sx={{
                                height: '20px',
                                fontSize: '0.7rem',
                                backgroundColor: '#f0f8ff',
                                color: '#6b7280',
                            }}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
} }
            sx={{
                minWidth: 200,
                '& .MuiAutocomplete-listbox': {
                    maxHeight: 300,
                },
            }}
        />
    );
}; 