import React, { useState } from 'react';
import {
  TextField,
  Button,
  Grid,
  Typography,
  FormControlLabel,
  Switch,
  Box,
  Paper,
  Slider,
  Chip,
  Snackbar,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Ingredient, Step, Meal } from '@mealplanner/generated';
import { createMeal } from './api';
import DeleteIcon from '@mui/icons-material/Delete';
import RepeatIcon from '@mui/icons-material/Repeat';
import StepsEditor from './components/StepsEditor';

interface AddRecipeFormProps {
  onRecipeAdded: () => void;
}

const createInitialMealState = (): Omit<Meal, 'id'> => {
  return new Meal({
    name: '',
    effort: 3,
    hasRedMeat: false,
    url: '',
    mealType: 'dinner',
    ingredients: [],
    steps: [],
  }) as Omit<Meal, 'id'>;
};

const AddRecipeForm: React.FC<AddRecipeFormProps> = ({ onRecipeAdded }) => {
  const [meal, setMeal] = useState<Omit<Meal, 'id'>>(createInitialMealState());
  const [rawIngredients, setRawIngredients] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Convert Unicode fraction characters to decimal values
  const convertFractions = (input: string): string => {
    const fractionMap: Record<string, string> = {
      '¼': '0.25',
      '½': '0.5',
      '¾': '0.75',
      '⅓': '0.33',
      '⅔': '0.67',
      '⅕': '0.2',
      '⅖': '0.4',
      '⅗': '0.6',
      '⅘': '0.8',
      '⅙': '0.17',
      '⅚': '0.83',
      '⅛': '0.125',
      '⅜': '0.375',
      '⅝': '0.625',
      '⅞': '0.875',
    };

    // Handle mixed numbers (e.g., 1½ -> 1.5)
    return input
      .replace(/(\d)([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (match, digit, fraction) => {
        return `${digit} ${fractionMap[fraction] || fraction}`;
      })
      .replace(/[¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (match) => fractionMap[match] || match);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMeal({ ...meal, name: e.target.value });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMeal({ ...meal, url: e.target.value });
  };

  const handleEffortChange = (e: Event, newValue: number | number[]) => {
    setMeal({ ...meal, effort: newValue as number });
  };

  const handleRedMeatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMeal({ ...meal, hasRedMeat: e.target.checked });
  };

  const handleMealTypeChange = (e: any) => {
    setMeal({ ...meal, mealType: e.target.value });
  };

  const handleRawIngredientsChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRawIngredients(e.target.value);
  };

  const doubleIngredientQuantities = () => {
    // Double quantities in already processed ingredients
    const doubledIngredients = meal.ingredients.map(
      (ing: Ingredient) =>
        new Ingredient({
          ...ing,
          quantity: ing.quantity * 2,
        }),
    );

    setMeal({ ...meal, ingredients: doubledIngredients });

    // Double quantities in raw ingredients text
    if (rawIngredients.trim()) {
      const lines = rawIngredients.split('\n');
      const doubledLines = lines.map((line) => {
        // Convert any Unicode fractions first
        const processed = convertFractions(line);

        // Look for number at the beginning of the line
        const match = processed.match(/^\s*(\d*\.?\d+)/);
        if (match && match[1]) {
          const quantity = parseFloat(match[1]);
          const doubled = (quantity * 2).toString();
          return processed.replace(match[1], doubled);
        }
        return line;
      });

      setRawIngredients(doubledLines.join('\n'));
    }
  };

  const processIngredients = () => {
    if (!rawIngredients.trim()) return;

    // Split by new lines
    const ingredientLines = rawIngredients
      .split('\n')
      .filter((line) => line.trim().length > 0);

    // Transform raw text to ingredients
    const newIngredients: Omit<Ingredient, 'id' | 'mealId'>[] =
      ingredientLines.map((line) => {
        // First convert any fraction characters to decimal values
        const processedLine = convertFractions(line);

        // Try to parse quantity, unit, and name
        // This is a basic implementation - can be enhanced with more sophisticated parsing
        const parts = processedLine.trim().split(' ');

        // Attempt to extract quantity (assume it's the first part if numeric)
        let quantityStr = parts[0];
        let quantity = parseFloat(quantityStr);
        let unit = '';
        let name = processedLine.trim();

        // If we have a valid quantity
        if (!isNaN(quantity)) {
          // Remove quantity from the beginning
          name = processedLine.trim().substring(quantityStr.length).trim();

          // Try to extract unit (assume it's the next word after quantity)
          const unitParts = name.split(' ');
          if (unitParts.length > 0) {
            unit = unitParts[0];
            // Common units - extend this list as needed
            const commonUnits = [
              'cup',
              'cups',
              'tbsp',
              'tsp',
              'oz',
              'lb',
              'g',
              'kg',
              'ml',
              'l',
              'pinch',
              'dash',
              'handful',
              'clove',
              'cloves',
              'bunch',
              'can',
              'slice',
              'slices',
              'piece',
              'pieces',
            ];

            if (commonUnits.includes(unit.toLowerCase())) {
              name = name.substring(unit.length).trim();
            } else {
              // If not a common unit, assume it's part of the name
              unit = '';
            }
          }
        } else {
          // No valid quantity found, treat entire line as name
          quantity = 0;
        }

        return new Ingredient({
          id: 0, // Will be excluded by Omit
          mealId: 0, // Will be excluded by Omit
          name: name,
          quantity: quantity,
          unit: unit,
        });
      });

    setMeal({
      ...meal,
      ingredients: [
        ...meal.ingredients,
        ...newIngredients.map(
          (ing) =>
            new Ingredient({
              ...ing,
              id: -1, // Temporary ID, will be assigned by backend
              mealId: 0, // Will be set by backend
            }),
        ),
      ],
    });
    setRawIngredients('');
  };

  const removeIngredient = (index: number) => {
    const updatedIngredients = [...meal.ingredients];
    updatedIngredients.splice(index, 1);
    setMeal({ ...meal, ingredients: updatedIngredients });
  };

  const handleStepsChange = (newSteps: Step[]) => {
    setMeal({
      ...meal,
      steps: newSteps,
    });
  };

  const addRecipe = async () => {
    if (meal.name.trim() === '') {
      setError('Recipe name is required');
      return;
    }

    if (meal.ingredients.length === 0) {
      setError('At least one ingredient is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mealData = {
        name: meal.name,
        effort: meal.effort,
        hasRedMeat: meal.hasRedMeat,
        url: meal.url,
        mealType: meal.mealType,
        ingredients: meal.ingredients,
        steps: meal.steps,
        lastPlanned: undefined,
      };

      const createdMeal = await createMeal(mealData);
      console.log('Successfully created meal:', createdMeal);

      setSuccess(true);
      setMeal(createInitialMealState());
      setRawIngredients('');
      onRecipeAdded();
    } catch (err) {
      setError(
        'Error adding recipe: ' +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Process any remaining raw ingredients
    processIngredients();

    await addRecipe();
  };

  const effortLabelFormat = (value: number) => {
    return ['Easy', 'Medium', 'Hard'][
      Math.min(Math.max(Math.floor(value) - 1, 0), 2)
    ];
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom align="center">
        Add New Recipe
      </Typography>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              label="Recipe Name"
              fullWidth
              value={meal.name}
              onChange={handleNameChange}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Recipe URL (optional)"
              fullWidth
              value={meal.url}
              onChange={handleUrlChange}
              placeholder="https://example.com/recipe"
              type="url"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography gutterBottom>Effort Level</Typography>
            <Slider
              value={meal.effort}
              onChange={handleEffortChange}
              step={1}
              marks
              min={1}
              max={5}
              valueLabelDisplay="auto"
              valueLabelFormat={effortLabelFormat}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="meal-type-label">Meal Type</InputLabel>
              <Select
                labelId="meal-type-label"
                id="meal-type-select"
                value={meal.mealType}
                label="Meal Type"
                onChange={handleMealTypeChange}
              >
                <MenuItem value="breakfast">Breakfast</MenuItem>
                <MenuItem value="lunch">Lunch</MenuItem>
                <MenuItem value="dinner">Dinner</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={meal.hasRedMeat}
                  onChange={handleRedMeatChange}
                />
              }
              label="Contains Red Meat"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Ingredients
            </Typography>

            <TextField
              label="Paste Ingredients (one per line)"
              multiline
              rows={5}
              fullWidth
              value={rawIngredients}
              onChange={handleRawIngredientsChange}
              placeholder="1 cup flour&#10;2 tbsp sugar&#10;¼ tsp salt"
              helperText="Paste a list of ingredients, one per line"
            />

            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                variant="outlined"
                onClick={processIngredients}
                disabled={!rawIngredients.trim()}
              >
                Process Ingredients
              </Button>

              <Button
                variant="outlined"
                startIcon={<RepeatIcon />}
                onClick={doubleIngredientQuantities}
                disabled={
                  !rawIngredients.trim() && meal.ingredients.length === 0
                }
                title="Double all ingredient quantities"
              >
                Double Quantities
              </Button>
            </Box>
          </Grid>

          {meal.ingredients.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Processed Ingredients:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {meal.ingredients.map((ing, index) => (
                  <Chip
                    key={index}
                    label={`${ing.quantity > 0 ? `${ing.quantity} ${ing.unit} ` : ''}${ing.name}`}
                    onDelete={() => removeIngredient(index)}
                    deleteIcon={<DeleteIcon />}
                  />
                ))}
              </Box>
            </Grid>
          )}

          <Divider sx={{ width: '100%', my: 3 }} />

          {/* Recipe Steps section - Only one heading here */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Recipe Steps
            </Typography>

            <StepsEditor
              steps={meal.steps || []}
              onChange={handleStepsChange}
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || meal.name === ''}
              fullWidth
            >
              {loading ? 'Adding Recipe...' : 'Add Recipe'}
            </Button>
          </Grid>
        </Grid>
      </form>

      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={() => setSuccess(false)}
      >
        <Alert severity="success" onClose={() => setSuccess(false)}>
          Recipe added successfully!
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default AddRecipeForm;
