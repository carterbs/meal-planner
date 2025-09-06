import React from 'react';
import { Box, Divider } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { DAYS_OF_THE_WEEK } from '@meal-planner/shared';
import { WeeklyMealPlan } from '@mealplanner/generated';
import MealTypeChip from './MealTypeChip';

interface MealPlanDisplayProps {
  plan: WeeklyMealPlan;
  highlights?: Set<string>;
  colors?: {
    cardBg: string;
    border: string;
    text: string;
    accent: string;
    apricot?: string;
    changedMealHighlight?: string;
  };
}

export const MealPlanDisplay: React.FC<MealPlanDisplayProps> = ({
  plan,
  highlights,
  colors,
}) => {
  // Default colors if none provided
  const theme = useTheme();
  const defaultColors = {
    cardBg: theme.palette.background.paper,
    border: theme.palette.divider,
    text: theme.palette.text.primary,
    accent: theme.palette.primary.main,
    changedMealHighlight: theme.palette.secondary.main,
  };
  const activeColors = colors || defaultColors;
  const grouped = DAYS_OF_THE_WEEK.map((day, idx) => ({
    day,
    entries: plan.days.filter((d) => d.dayIndex === idx),
  }));
  const visibleGroups = grouped.filter((g) => g.entries.length > 0);

  return (
    <Box
      data-testid="meal-plan-table"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flex: 1,
        overflow: 'auto',
      }}
    >
      {visibleGroups.map(({ day, entries }, idx) => (
        <React.Fragment key={day}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {/* Day name - above card */}
            <Box
              sx={{
                fontSize: '1rem',
                fontWeight: 600,
                color: activeColors.text,
                letterSpacing: '0.3px',
                position: 'sticky',
                top: 0,
                zIndex: 1,
                backgroundColor: 'background.default',
                py: 1,
              }}
            >
              {day}
            </Box>

            {/* Card with meals */}
            <Box
              sx={{
                backgroundColor: activeColors.cardBg,
                borderRadius: theme.shape.borderRadius,
                p: 2,
                boxShadow: theme.shadows[1],
                border: `1px solid ${activeColors.border}`,
              }}
            >
              {/* Meals laid out horizontally: Breakfast | Lunch | Dinner */}
              {(() => {
                // Keep a deterministic order and ensure placeholders exist
                const order: Array<'breakfast' | 'lunch' | 'dinner'> = [
                  'breakfast',
                  'lunch',
                  'dinner',
                ];
                type EntryLike = {
                  dayIndex: number;
                  mealType: string;
                  meal?: { name: string; effort: number } | null;
                };
                const byType: Record<string, EntryLike | undefined> = {};
                entries.forEach((e) => {
                  byType[e.mealType] = e as unknown as EntryLike;
                });
                const ordered: EntryLike[] = order.map((t) =>
                  byType[t] ?? {
                    dayIndex: entries[0].dayIndex,
                    mealType: t,
                    meal: null,
                  },
                );

                return (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(3, 1fr)',
                      },
                      gap: 1,
                      alignItems: 'stretch',
                    }}
                  >
                    {ordered.map((e) => {
                      const key = `${e.dayIndex}-${e.mealType}`;
                      const isHighlighted = highlights?.has(key);
                      const isEmpty = !e.meal;
                      return (
                        <Box
                          key={e.mealType}
                          data-testid={`meal-${key}`}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            p: 1,
                            border: `1px solid ${activeColors.border}`,
                            borderRadius: '10px',
                            backgroundColor: 'transparent',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              width: '100%',
                            }}
                          >
                            <MealTypeChip mealType={e.mealType} />
                            <Box
                              component="span"
                              data-testid={`meal-name-${key}`}
                              data-highlighted={isHighlighted ? 'true' : undefined}
                              sx={{
                                fontSize: '0.95rem',
                                color: isEmpty
                                  ? theme.palette.text.disabled
                                  : activeColors.text,
                                borderLeft: `2px solid transparent`,
                                fontStyle: isEmpty ? 'italic' : 'normal',
                                ...(isHighlighted && {
                                  backgroundColor: alpha(
                                    activeColors.changedMealHighlight,
                                    0.25,
                                  ),
                                  borderLeft: `2px solid ${activeColors.changedMealHighlight}`,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  transition: 'all 2s ease-out',
                                  animation: 'highlightFade 5s forwards',
                                  '@keyframes highlightFade': {
                                    '0%': {
                                      backgroundColor: alpha(
                                        activeColors.changedMealHighlight,
                                        0.25,
                                      ),
                                      borderLeft: `2px solid ${activeColors.changedMealHighlight}`,
                                    },
                                    '50%': {
                                      backgroundColor: alpha(
                                        activeColors.changedMealHighlight,
                                        0.15,
                                      ),
                                      borderLeft: `2px solid ${activeColors.changedMealHighlight}`,
                                    },
                                    '100%': {
                                      backgroundColor: 'transparent',
                                      borderLeft: '2px solid transparent',
                                    },
                                  },
                                }),
                              }}
                            >
                              {e.meal ? e.meal.name : '---'}
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })()}
            </Box>
          </Box>
          {idx < visibleGroups.length - 1 && (
            <Divider sx={{ my: 1, opacity: 0.5 }} />
          )}
        </React.Fragment>
      ))}
    </Box>
  );
};

export default MealPlanDisplay;
