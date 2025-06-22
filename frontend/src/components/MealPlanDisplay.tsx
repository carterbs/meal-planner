import React from 'react';
import { Box } from '@mui/material';

interface MealInfo {
  id: number;
  name: string;
  effort: number;
  hasRedMeat?: boolean;
}

interface DayEntry {
  dayIndex: number;
  mealType: string;
  meal: MealInfo;
}

export interface WeeklyMealPlan {
  days: DayEntry[];
}

const WEEK_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const effortIcons = ['','🔥','🔥🔥','🔥🔥🔥'];

interface MealPlanDisplayProps {
  plan: WeeklyMealPlan;
  highlights?: Set<string>;
}

export const MealPlanDisplay: React.FC<MealPlanDisplayProps> = ({ plan, highlights }) => {
  const grouped = WEEK_DAYS.map((day, idx) => {
    const entries = plan.days.filter(d => d.dayIndex === idx);
    return { day, entries };
  });

  return (
    <table data-testid="meal-plan-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Day</th>
          <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Meals</th>
        </tr>
      </thead>
      <tbody>
        {grouped.map(({ day, entries }) => (
          entries.length > 0 ? (
            <tr key={day}>
              <td style={{ border: '1px solid #ddd', padding: 4 }}>{day}</td>
              <td style={{ border: '1px solid #ddd', padding: 4 }}>
                {entries.map(e => {
                  const key = `${e.dayIndex}-${e.mealType}`;
                  const isHighlighted = highlights?.has(key);
                  return (
                    <div
                      key={e.mealType}
                      data-testid={`meal-${key}`}
                      style={{ padding: '4px', margin: '2px 0' }}
                    >
                      <strong>{e.mealType.charAt(0).toUpperCase()+e.mealType.slice(1)}:</strong>{' '}
                      <Box
                        component="span"
                        sx={{
                          ...(isHighlighted && {
                            backgroundColor: '#81c784',
                            borderLeft: '4px solid #4caf50',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            transition: 'all 2s ease-out',
                            '&': {
                              animation: 'highlightFade 5s forwards',
                            },
                            '@keyframes highlightFade': {
                              '0%': { 
                                backgroundColor: '#81c784', 
                                borderLeft: '4px solid #4caf50' 
                              },
                              '50%': { 
                                backgroundColor: '#c8e6c9', 
                                borderLeft: '4px solid #4caf50' 
                              },
                              '100%': { 
                                backgroundColor: 'transparent', 
                                borderLeft: '4px solid transparent' 
                              }
                            }
                          })
                        }}
                      >
                        {e.meal.name}
                      </Box>
                      {' '}{effortIcons[e.meal.effort]}
                      {e.meal.hasRedMeat && ' 🥩'}
                    </div>
                  );
                })}
              </td>
            </tr>
          ) : null
        ))}
      </tbody>
    </table>
  );
};

export default MealPlanDisplay;
