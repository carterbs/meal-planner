import React from 'react';
import { Box } from '@mui/material';
import { DAYS_OF_THE_WEEK } from '@meal-planner/shared';

interface MealInfo {
  id: number;
  name: string;
  effort: number;
  hasRedMeat?: boolean;
}

interface DayEntry {
  dayIndex: number;
  mealType: string;
  meal: MealInfo | null;
}

export interface WeeklyMealPlan {
  days: DayEntry[];
}

const effortIcons = ['', '🔥', '🔥🔥', '🔥🔥🔥'];

interface MealPlanDisplayProps {
  plan: WeeklyMealPlan;
  highlights?: Set<string>;
}

export const MealPlanDisplay: React.FC<MealPlanDisplayProps> = ({
  plan,
  highlights,
}) => {
  const grouped = DAYS_OF_THE_WEEK.map((day, idx) => ({
    day,
    entries: plan.days.filter((d) => d.dayIndex === idx),
  }));

  return (
    <table
      data-testid="meal-plan-table"
      style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9em' }}
    >
      <thead>
        <tr>
          <th
            style={{
              border: '1px solid #ddd',
              padding: '4px 8px',
              textAlign: 'left',
              fontSize: '0.9em',
            }}
          >
            Day
          </th>
          <th
            style={{
              border: '1px solid #ddd',
              padding: '4px 8px',
              textAlign: 'left',
              fontSize: '0.9em',
            }}
          >
            Meals
          </th>
        </tr>
      </thead>
      <tbody>
        {grouped.map(({ day, entries }) =>
          entries.length > 0 ? (
            <tr key={day}>
              <td
                style={{
                  border: '1px solid #ddd',
                  padding: '4px 8px',
                  verticalAlign: 'top',
                  whiteSpace: 'nowrap',
                }}
              >
                {day}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {entries.map((e) => {
                    const key = `${e.dayIndex}-${e.mealType}`;
                    const isHighlighted = highlights?.has(key);
                    const isEmpty = !e.meal;
                    return (
                      <div
                        key={e.mealType}
                        data-testid={`meal-${key}`}
                        style={{ margin: '1px 0', lineHeight: '1.3' }}
                      >
                        <strong>
                          {e.mealType.charAt(0).toUpperCase() +
                            e.mealType.slice(1)}
                          :
                        </strong>{' '}
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
                                  borderLeft: '4px solid #4caf50',
                                },
                                '50%': {
                                  backgroundColor: '#c8e6c9',
                                  borderLeft: '4px solid #4caf50',
                                },
                                '100%': {
                                  backgroundColor: 'transparent',
                                  borderLeft: '4px solid transparent',
                                },
                              },
                            }),
                            ...(isEmpty && {
                              fontStyle: 'italic',
                              color: '#757575',
                            }),
                          }}
                        >
                          {e.meal ? e.meal.name : '---'}
                        </Box>
                        {e.meal && (
                          <span style={{ whiteSpace: 'nowrap' }}>
                            {' '}
                            {effortIcons[e.meal.effort]}
                            {e.meal.hasRedMeat && ' 🥩'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>
          ) : null,
        )}
      </tbody>
    </table>
  );
};

export default MealPlanDisplay;
