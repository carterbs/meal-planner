import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CircularProgress,
  IconButton,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';

import { Ingredient } from '../types';
import { Meal } from '@meal-planner/shared/types';
import { MealAutocomplete } from './MealAutocomplete';
import { DAYS_OF_THE_WEEK } from '../../../shared/days';

interface MealPlanTabProps {
  showToast: (message: string) => void;
}

// Define meal types for each day
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

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
  const [isLoadingShoppingList, setIsLoadingShoppingList] =
    useState<boolean>(false);
  const [shoppingListError, setShoppingListError] = useState<string | null>(
    null,
  );
  const [skipDays, setSkipDays] = useState<string[]>([]);
  const [skippedMeals, setSkippedMeals] = useState<Set<string>>(new Set());
  const [removedIngredients, setRemovedIngredients] = useState<Set<string>>(
    new Set(),
  );

  // Debounced shopping list generation function
  const generateShoppingListAutomatic = useCallback(async () => {
    if (!mealPlan) return;

    // Get all non-skipped meals
    const mealIDs: number[] = [];
    DAYS_OF_THE_WEEK.forEach((day) => {
      MEAL_TYPES.forEach((mealType) => {
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
      const response = await fetch('/api/shoppinglist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: mealIDs }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate shopping list: ${response.status}`);
      }

      const ingredients: Ingredient[] = await response.json();
      setShoppingList(ingredients);
    } catch (err) {
      console.error('Error getting shopping list:', err);
      setShoppingListError('Failed to generate shopping list');
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
          fetch('/api/mealplan'),
          fetch('/api/meals'),
        ]);

        const [mealPlanData, availableMealsData] = await Promise.all([
          mealPlanRes.json(),
          availableMealsRes.json(),
        ]);

        if (isMounted) {
          // The new API returns the extended meal plan format directly.
          setMealPlan(mealPlanData);
          setAvailableMeals(availableMealsData);
        }
      } catch (err) {
        console.error('Error fetching meal plan or available meals:', err);
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

    // The API now accepts the full extended meal plan.
    fetch('/api/mealplan/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mealPlan),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Finalize error: ${res.status}`);
        }
        return res.text();
      })
      .then((text) => showToast(text))
      .catch((err) => console.error('Error finalizing plan:', err));
  };

  const generateNewPlan = () => {
    setIsGeneratingPlan(true);
    fetch('/api/mealplan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skipDays.length ? { skip_days: skipDays } : {}),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to generate meal plan');
        }
        return response.json();
      })
      .then((data) => {
        // The new API returns the extended meal plan format directly.
        setMealPlan(data);
        setShoppingList([]);
        setSkippedMeals(new Set());
        showToast('New meal plan generated!');
        // Shopping list will be auto-generated via useEffect
      })
      .catch((err) => {
        console.error('Error generating meal plan:', err);
        showToast('Error generating new meal plan');
      })
      .finally(() => {
        setIsGeneratingPlan(false);
      });
  };

  const updateMeal = (day: string, mealType: string, newMeal: Meal | null) => {
    if (!mealPlan) return;

    setMealPlan((prevPlan) => {
      if (!prevPlan) return null;
      const newPlan = JSON.parse(JSON.stringify(prevPlan));
      newPlan[day][mealType] = newMeal;
      return newPlan;
    });

    if (newMeal) {
      showToast(`Updated ${day} ${mealType} to: ${newMeal.mealName}`);
    } else {
      showToast(`Cleared ${day} ${mealType}`);
    }
  };

  const toggleSkipDay = (day: string) => {
    setSkipDays((prev) => {
      const newSkipDays = prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day];
      return newSkipDays;
    });
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
    if (!mealPlan) return;

    // Collect all ingredients from visible meal cards
    const allIngredients: {
      [name: string]: { quantity: number; unit: string; name: string };
    } = {};

    DAYS_OF_THE_WEEK.forEach((day) => {
      MEAL_TYPES.forEach((mealType) => {
        const meal = mealPlan[day][mealType];
        const mealKey = `${day}-${mealType}`;

        if (meal && !skippedMeals.has(mealKey) && meal.ingredients) {
          meal.ingredients.forEach((ingredient) => {
            const ingredientKey = `${meal.id}-${ingredient.ID}`;

            // Skip removed ingredients
            if (removedIngredients.has(ingredientKey)) return;

            // Aggregate ingredients by name
            if (allIngredients[ingredient.Name]) {
              allIngredients[ingredient.Name].quantity += ingredient.Quantity;
            } else {
              allIngredients[ingredient.Name] = {
                quantity: ingredient.Quantity,
                unit: ingredient.Unit,
                name: ingredient.Name,
              };
            }
          });
        }
      });
    });

    // Format for clipboard
    const formattedList = Object.values(allIngredients)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (item) =>
          `${item.quantity > 0 ? `${item.quantity} ${item.unit} ` : ''}${item.name}`,
      )
      .join('\n');

    navigator.clipboard
      .writeText(formattedList)
      .then(() => showToast('Shopping list copied to clipboard!'))
      .catch((err) => {
        console.error('Failed to copy to clipboard:', err);
        showToast('Failed to copy to clipboard');
      });
  };

  const copyMealPlanToClipboard = () => {
    if (!mealPlan) return;

    // Create an HTML table representation that will be properly recognized by Apple Notes
    let htmlContent = '<table style="border-collapse: collapse; width: 100%;">';

    // Add table header with styling
    htmlContent += `
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Day</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Meals</th>
            </tr>
          </thead>
          <tbody>
        `;

    // Add each day's meal information as table rows
    DAYS_OF_THE_WEEK.forEach((day) => {
      const dayMeals = MEAL_TYPES.map((mealType) => {
        const meal = mealPlan[day][mealType];
        const mealKey = `${day}-${mealType}`;

        if (meal && !skippedMeals.has(mealKey)) {
          // Format meal name with URL if available
          const mealDisplay = meal.url
            ? `<a href="${meal.url}" style="color: #2196f3; text-decoration: underline;">${meal.mealName}</a>`
            : meal.mealName;
          return `${mealType}: ${mealDisplay} (${meal.relativeEffort})`;
        }
        return null;
      }).filter(Boolean);

      if (dayMeals.length > 0) {
        // Join meals with line breaks for multi-line cell
        const mealsHtml = dayMeals.join('<br>');

        htmlContent += `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${day}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${mealsHtml}</td>
                  </tr>
                `;
      }
    });

    htmlContent += '</tbody></table>';

    // Also create a plain text fallback for applications that don't support HTML
    let textContent = 'Day | Meals\n';
    textContent += '----|-------\n';

    DAYS_OF_THE_WEEK.forEach((day) => {
      const dayMeals = MEAL_TYPES.map((mealType) => {
        const meal = mealPlan[day][mealType];
        const mealKey = `${day}-${mealType}`;

        if (meal && !skippedMeals.has(mealKey)) {
          // Format meal name with URL if available
          const mealName = meal.url
            ? `${meal.mealName} (${meal.url})`
            : meal.mealName;
          return `${mealType}: ${mealName} (${meal.relativeEffort})`;
        }
        return null;
      }).filter(Boolean);

      if (dayMeals.length > 0) {
        // Join meals with semicolons for plain text
        const mealsText = dayMeals.join('; ');
        textContent += `${day} | ${mealsText}\n`;
      }
    });

    // Use the modern clipboard API to write both HTML and text formats
    // This makes both formats available so the receiving application can choose the best one
    try {
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([textContent], { type: 'text/plain' }),
      });

      navigator.clipboard
        .write([clipboardItem])
        .then(() => showToast('Meal plan copied to clipboard!'))
        .catch((err) => {
          console.error('Failed to copy formatted content:', err);
          // Fall back to plain text if the enhanced version fails
          navigator.clipboard
            .writeText(textContent)
            .then(() =>
              showToast('Meal plan copied to clipboard (plain text only)!'),
            )
            .catch((err) => {
              console.error('Failed to copy to clipboard:', err);
              showToast('Failed to copy to clipboard');
            });
        });
    } catch (error) {
      // Handle browsers that don't support ClipboardItem
      console.error('Advanced clipboard features not supported:', error);
      navigator.clipboard
        .writeText(textContent)
        .then(() => showToast('Meal plan copied to clipboard (basic format)!'))
        .catch((err) => {
          console.error('Failed to copy to clipboard:', err);
          showToast('Failed to copy to clipboard');
        });
    }
  };

  const removeIngredient = (mealId: number, ingredientId: number) => {
    const ingredientKey = `${mealId}-${ingredientId}`;
    setRemovedIngredients((prev) => new Set([...prev, ingredientKey]));
    showToast('Ingredient removed from shopping list');
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
          <MealAutocomplete
            value={meal}
            onChange={(newMeal) => updateMeal(day, mealType, newMeal)}
            mealType={mealType}
            disabled={isSkipped}
            placeholder={`Select ${mealType.toLowerCase()}...`}
          />

          {meal && (
            <Typography variant="mealEffort">
              Effort: {meal.relativeEffort}
            </Typography>
          )}

          {/* Ingredients */}
          {meal?.ingredients && meal.ingredients.length > 0 && !isSkipped && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '6px',
                marginTop: '8px',
              }}
            >
              {meal.ingredients
                .filter(
                  (ingredient) =>
                    !removedIngredients.has(`${meal.id}-${ingredient.ID}`),
                )
                .map((ingredient, index) => (
                  <Box
                    key={index}
                    sx={{
                      background:
                        'linear-gradient(135deg, #fefffe 0%, #fafcf8 100%)',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      border: '1px solid #e8f0e5',
                      color: '#6b7668',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '4px',
                      '&:hover': {
                        background:
                          'linear-gradient(135deg, #fafcf8 0%, #f6faf3 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 2px 8px rgba(127, 176, 105, 0.08)',
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {`${ingredient.Quantity > 0 ? `${ingredient.Quantity} ${ingredient.Unit} ` : ''}${ingredient.Name}`}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => removeIngredient(meal.id, ingredient.ID)}
                      sx={{
                        padding: '2px',
                        width: '16px',
                        height: '16px',
                        color: '#8a9584',
                        '&:hover': {
                          color: '#d32f2f',
                          backgroundColor: 'rgba(211, 47, 47, 0.1)',
                        },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: '12px' }} />
                    </IconButton>
                  </Box>
                ))}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
          flexDirection: 'column',
          gap: 2,
        }}
      >
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
            startIcon={
              isGeneratingPlan ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RestaurantIcon />
              )
            }
            sx={{
              background: 'linear-gradient(135deg, #7fb069 0%, #1b998b 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #6fa055 0%, #178a7a 100%)',
              },
            }}
          >
            {isGeneratingPlan ? 'Generating...' : 'Generate New Plan'}
          </Button>
          <Button
            variant="outlined"
            onClick={finalizePlan}
            disabled={!mealPlan}
          >
            Finalize Meal Plan
          </Button>
          <Button
            variant="contained"
            onClick={copyShoppingListToClipboard}
            disabled={!mealPlan}
            startIcon={<ShoppingCartIcon />}
            sx={{
              background: 'linear-gradient(135deg, #1b998b 0%, #7fb069 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #178a7a 0%, #6fa055 100%)',
              },
            }}
          >
            Copy Shopping List
          </Button>
          <Button
            variant="contained"
            onClick={copyMealPlanToClipboard}
            disabled={!mealPlan}
            startIcon={<ContentCopyIcon />}
            sx={{
              background: 'linear-gradient(135deg, #1b998b 0%, #7fb069 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #178a7a 0%, #6fa055 100%)',
              },
            }}
          >
            Copy Meal Plan
          </Button>
        </Box>
        <Box
          sx={{
            marginLeft: 'auto',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <Button
            variant="outlined"
            onClick={() =>
              window.open('http://localhost:8080/api/mealplan/ics', '_blank')
            }
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
            {DAYS_OF_THE_WEEK.map((day) => (
              <Card
                key={day}
                sx={{
                  background:
                    'linear-gradient(135deg, #fefffe 0%, #fbfef9 100%)',
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
                    background:
                      'linear-gradient(135deg, #fafcf8 0%, #f6faf3 100%)',
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
                      background:
                        'linear-gradient(90deg, #7fb069 0%, #1b998b 100%)',
                    },
                  }}
                >
                  <Typography variant="dayHeader">{day}</Typography>
                </Box>

                {/* Meal Slots */}
                <Box sx={{ padding: '20px', display: 'grid', gap: '16px' }}>
                  {MEAL_TYPES.map((mealType) =>
                    renderMealSlot(day, mealType, mealPlan[day][mealType]),
                  )}
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
