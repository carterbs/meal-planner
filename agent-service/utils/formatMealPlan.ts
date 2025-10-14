/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { MealPlan } from '@mealplanner/generated';
import { DAYS_OF_THE_WEEK as WEEK_DAYS } from '../shared/days';
import { mealSlotToString } from '../workflows/meal-planning/mealPlanUtils';
/**
 * Formats a MealPlan into HTML and plain-text tables.
 */
export function formatMealPlan(plan: MealPlan): {
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
    const entries = plan.items.filter((d) => d.dayIndex === idx);
    if (entries.length === 0) return;
    // HTML cell
    const mealsHtml = entries
      .filter((e) => e.mealSnapshot)
      .map((e) => {
        const meal = e.mealSnapshot!;
        const slot = mealSlotToString(e.mealType);
        const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
        return `<strong>${slotLabel}</strong>: ${meal.name} (${meal.effort})`;
      })
      .join('<br>');
    html +=
      `<tr><td style="border:1px solid #ddd;padding:8px;">${day}</td>` +
      `<td style="border:1px solid #ddd;padding:8px;">${mealsHtml}</td></tr>`;
    // Text cell
    const mealsText = entries
      .filter((e) => e.mealSnapshot)
      .map((e) => {
        const meal = e.mealSnapshot!;
        const slot = mealSlotToString(e.mealType);
        return `${slot}: ${meal.name} (${meal.effort})`;
      })
      .join('; ');
    text += `${day} | ${mealsText}\n`;
  });
  html += '</tbody></table>';
  return { html, text };
}
