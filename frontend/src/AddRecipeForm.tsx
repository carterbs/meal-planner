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
  IconButton,
  Snackbar,
  Alert
} from '@mui/material';
import { Meal, Ingredient } from './types';
import DeleteIcon from '@mui/icons-material/Delete';

interface AddRecipeFormProps {
  onRecipeAdded: () => void;
}

const initialMealState: Omit<Meal, 'id' | 'lastPlanned'> = {
  mealName: '',
  relativeEffort: 3,
  redMeat: false,
  ingredients: []
};

const AddRecipeForm: React.FC<AddRecipeFormProps> = ({ onRecipeAdded }) => {
  const [meal, setMeal] = useState<Omit<Meal, 'id' | 'lastPlanned'>>(initialMealState);
  const [rawIngredients, setRawIngredients] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMeal({ ...meal, mealName: e.target.value });
  };

  const handleEffortChange = (e: Event, newValue: number | number[]) => {
    setMeal({ ...meal, relativeEffort: newValue as number });
  };

  const handleRedMeatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMeal({ ...meal, redMeat: e.target.checked });
  };

  const handleRawIngredientsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawIngredients(e.target.value);
  };

  const processIngredients = () => {
    if (!rawIngredients.trim()) return;

    // Split by new lines
    const ingredientLines = rawIngredients
      .split('\n')
      .filter(line => line.trim().length > 0);

    // Transform raw text to ingredients
    const newIngredients: Omit<Ingredient, 'ID'>[] = ingredientLines.map(line => {
      // Try to parse quantity, unit, and name
      // This is a basic implementation - can be enhanced with more sophisticated parsing
      const parts = line.trim().split(' ');
      
      // Attempt to extract quantity (assume it's the first part if numeric)
      let quantityStr = parts[0];
      let quantity = parseFloat(quantityStr);
      let unit = '';
      let name = line.trim();

      // If we have a valid quantity
      if (!isNaN(quantity)) {
        // Remove quantity from the beginning
        name = line.trim().substring(quantityStr.length).trim();
        
        // Try to extract unit (assume it's the next word after quantity)
        const unitParts = name.split(' ');
        if (unitParts.length > 0) {
          unit = unitParts[0];
          // Common units - extend this list as needed
          const commonUnits = [
            'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l',
            'pinch', 'dash', 'handful', 'clove', 'cloves', 'bunch', 'can',
            'slice', 'slices', 'piece', 'pieces'
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

      return {
        Name: name,
        Quantity: quantity,
        Unit: unit
      };
    });

    setMeal({
      ...meal,
      ingredients: [...meal.ingredients, ...newIngredients.map(ing => ({
        ...ing,
        ID: -1 // Temporary ID, will be assigned by backend
      }))]
    });
    setRawIngredients('');
  };

  const removeIngredient = (index: number) => {
    const updatedIngredients = [...meal.ingredients];
    updatedIngredients.splice(index, 1);
    setMeal({ ...meal, ingredients: updatedIngredients });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Process any remaining raw ingredients
    processIngredients();
    
    if (!meal.mealName.trim()) {
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
      // Convert to the format expected by the backend
      const mealData = {
        ...meal,
        ingredients: meal.ingredients.map(ing => ({
          Name: ing.Name,
          Quantity: ing.Quantity,
          Unit: ing.Unit,
          MealID: 0 // This will be set by the backend
        }))
      };

      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mealData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create recipe');
      }

      // Reset form
      setMeal(initialMealState);
      setRawIngredients('');
      setSuccess(true);
      
      // Notify parent component that a recipe was added
      onRecipeAdded();
    } catch (err: any) {
      setError(err.message || 'Error creating recipe');
    } finally {
      setLoading(false);
    }
  };

  const effortLabelFormat = (value: number) => {
    return ['Easy', 'Medium', 'Hard'][Math.min(Math.max(Math.floor(value) - 1, 0), 2)];
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        Add New Recipe
      </Typography>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              label="Recipe Name"
              fullWidth
              value={meal.mealName}
              onChange={handleNameChange}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography gutterBottom>Effort Level</Typography>
            <Slider
              value={meal.relativeEffort}
              onChange={handleEffortChange}
              step={1}
              marks
              min={1}
              max={5}
              valueLabelDisplay="auto"
              valueLabelFormat={effortLabelFormat}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch 
                  checked={meal.redMeat} 
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
              placeholder="1 cup flour&#10;2 tbsp sugar&#10;1/4 tsp salt"
              helperText="Paste a list of ingredients, one per line"
            />
            
            <Button 
              variant="outlined" 
              onClick={processIngredients}
              disabled={!rawIngredients.trim()}
              sx={{ mt: 1 }}
            >
              Process Ingredients
            </Button>
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
                    label={`${ing.Quantity > 0 ? `${ing.Quantity} ${ing.Unit} ` : ''}${ing.Name}`}
                    onDelete={() => removeIngredient(index)}
                    deleteIcon={<DeleteIcon />}
                  />
                ))}
              </Box>
            </Grid>
          )}
          
          <Grid item xs={12}>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              disabled={loading || meal.mealName === ''}
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