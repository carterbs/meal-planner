import React from 'react';

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

export const MealPlanDisplay: React.FC<{ plan: WeeklyMealPlan }> = ({ plan }) => {
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
                {entries.map(e => (
                  <div key={e.mealType}>
                    <strong>{e.mealType.charAt(0).toUpperCase()+e.mealType.slice(1)}:</strong> {e.meal.name}
                    {' '}{effortIcons[e.meal.effort]}
                    {e.meal.hasRedMeat && ' 🥩'}
                  </div>
                ))}
              </td>
            </tr>
          ) : null
        ))}
      </tbody>
    </table>
  );
};

export default MealPlanDisplay;
