import React from 'react';
import { Box } from '@mui/material';
import { DAYS_OF_THE_WEEK } from '@meal-planner/shared';
import { MealPlan } from '@mealplanner/generated/api_pb';
import { planToEntries } from '../../../../utils/mealPlanUtils';

const effortIcons = {
  easy: '🙂',
  medium: '😅',
  hard: '😫',
  veryHard: '🥵',
};

export const getEffortIcon = (effort: number) => {
  if (effort > 7) {
    return effortIcons.veryHard;
  } else if (effort > 5) {
    return effortIcons.hard;
  } else if (effort > 3) {
    return effortIcons.medium;
  } else {
    return effortIcons.easy;
  }
};

interface MealPlanDisplayProps {
  plan: MealPlan;
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
  const defaultColors = {
    cardBg: '#faf9f6',
    border: 'rgba(139, 115, 85, 0.1)',
    text: '#2c2c2c',
    accent: '#6b8c5d',
    changedMealHighlight: '#92ca92',
  };
  const activeColors = colors || defaultColors;
  const entries = planToEntries(plan);
  const grouped = DAYS_OF_THE_WEEK.map((day, idx) => ({
    day,
    entries: entries.filter((d) => d.dayIndex === idx),
  }));

  return (
    <Box
      data-testid="meal-plan-table"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        flex: 1,
        overflow: 'auto',
      }}
    >
      {grouped.map(({ day, entries }) =>
        entries.length > 0 ? (
          <Box
            key={day}
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
                mb: 0.5,
              }}
            >
              {day}
            </Box>

            {/* Card with meals */}
            <Box
              sx={{
                backgroundColor: activeColors.cardBg,
                borderRadius: '16px',
                p: 1.5,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
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
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: 0.5,
                            p: 1,
                            border: '1px solid rgba(0,0,0,0.05)',
                            borderRadius: '10px',
                            backgroundColor: 'transparent',
                          }}
                        >
                          <Box
                            sx={{
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              color: activeColors.text,
                              opacity: 0.6,
                              fontVariant: 'small-caps',
                              letterSpacing: '0.5px',
                              textAlign: 'left',
                            }}
                          >
                            {e.mealType}
                          </Box>
                          <Box
                            component="span"
                            data-testid={`meal-name-${key}`}
                            data-highlighted={isHighlighted ? 'true' : undefined}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 0.5,
                              fontSize: '0.95rem',
                              color: isEmpty ? '#a0a0a0' : activeColors.text,
                              borderLeft: `2px solid transparent`,
                              fontStyle: isEmpty ? 'italic' : 'normal',
                              ...(isHighlighted && {
                                backgroundColor: `${activeColors.changedMealHighlight}100`,
                                borderLeft: `2px solid ${activeColors.changedMealHighlight}`,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                transition: 'all 2s ease-out',
                                animation: 'highlightFade 5s forwards',
                                '@keyframes highlightFade': {
                                  '0%': {
                                    backgroundColor: `${activeColors.changedMealHighlight}40`,
                                    borderLeft: `2px solid ${activeColors.changedMealHighlight}`,
                                  },
                                  '50%': {
                                    backgroundColor: `${activeColors.changedMealHighlight}25`,
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
                            {e.meal && (
                              <Box sx={{ fontSize: '1.1rem' }}>
                                {getEffortIcon(e.meal.effort)}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })()}
            </Box>
          </Box>
        ) : null,
      )}
    </Box>
  );
};

export default MealPlanDisplay;
