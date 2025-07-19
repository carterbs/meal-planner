import React from 'react';
import { Box } from '@mui/material';
import { DAYS_OF_THE_WEEK } from '@meal-planner/shared';
import { WeeklyMealPlan } from '../types';

const effortIcons = {
  easy: '🙂',
  medium: '😅',
  hard: '😫',
  veryHard: '🥵',
};

const getEffortIcon = (effort: number) => {
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
  plan: WeeklyMealPlan;
  highlights?: Set<string>;
  colors?: {
    cardBg: string;
    border: string;
    text: string;
    accent: string;
    apricot?: string;
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
  };
  const activeColors = colors || defaultColors;
  const grouped = DAYS_OF_THE_WEEK.map((day, idx) => ({
    day,
    entries: plan.days.filter((d) => d.dayIndex === idx),
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
              {/* Meals grid */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                {entries.map((e) => {
                  const key = `${e.dayIndex}-${e.mealType}`;
                  const isHighlighted = highlights?.has(key);
                  const isEmpty = !e.meal;
                  return (
                    <Box
                      key={e.mealType}
                      data-testid={`meal-${key}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr auto',
                        alignItems: 'center',
                        gap: 1,
                        py: 0,
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                        '&:last-child': {
                          borderBottom: 'none',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          fontSize: '1rem',
                          fontWeight: 400,
                          color: activeColors.text,
                          opacity: 0.5,
                          fontVariant: 'small-caps',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {e.mealType}
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          fontSize: '0.875rem',
                          color: isEmpty ? '#a0a0a0' : activeColors.text,
                          fontStyle: isEmpty ? 'italic' : 'normal',
                          ...(isHighlighted && {
                            backgroundColor: `${activeColors.accent}25`,
                            borderLeft: `2px solid ${activeColors.accent}`,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            transition: 'all 2s ease-out',
                            animation: 'highlightFade 5s forwards',
                            '@keyframes highlightFade': {
                              '0%': {
                                backgroundColor: `${activeColors.accent}40`,
                                borderLeft: `2px solid ${activeColors.accent}`,
                              },
                              '50%': {
                                backgroundColor: `${activeColors.accent}25`,
                                borderLeft: `2px solid ${activeColors.accent}`,
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
                      {e.meal && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.3,
                            fontSize: '1.2rem',
                          }}
                        >
                          {getEffortIcon(e.meal.effort)}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        ) : null,
      )}
    </Box>
  );
};

export default MealPlanDisplay;
