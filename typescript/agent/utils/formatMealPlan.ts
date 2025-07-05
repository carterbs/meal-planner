import { WeeklyMealPlan } from '../shared/types';
import { DAYS_OF_THE_WEEK as WEEK_DAYS } from '@meal-planner/shared';

/**
 * Formats a WeeklyMealPlan into HTML and plain-text tables.
 */
export function formatMealPlan(plan: WeeklyMealPlan): {
  html: string;
  text: string;
} {
  let html = '<table style="border-collapse: collapse; width: 100%;">';
  html +=
    '<thead><tr>' +
    '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Day</th>' +
    '<th style="border:1px solid #ddd;padding:8px;text-align:left;">Meals</th>' +
    '</tr></thead><tbody>';

  let text = 'Day | Meals\n';
  text += '----|------\n';

  WEEK_DAYS.forEach((day, idx) => {
    const entries = plan.days.filter((d) => d.dayIndex === idx);
    if (entries.length === 0) return;

    // HTML cell
    const mealsHtml = entries
      .filter((e) => e.meal)
      .map((e) => {
        const meal = e.meal!;
        return `<strong>${e.mealType.charAt(0).toUpperCase() + e.mealType.slice(1)}</strong>: ${meal.name} (${meal.effort})`;
      })
      .join('<br>');
    html +=
      `<tr><td style="border:1px solid #ddd;padding:8px;">${day}</td>` +
      `<td style="border:1px solid #ddd;padding:8px;">${mealsHtml}</td></tr>`;

    // Text cell
    const mealsText = entries
      .filter((e) => e.meal)
      .map((e) => {
        const meal = e.meal!;
        return `${e.mealType}: ${meal.name} (${meal.effort})`;
      })
      .join('; ');
    text += `${day} | ${mealsText}\n`;
  });

  html += '</tbody></table>';

  return { html, text };
}
