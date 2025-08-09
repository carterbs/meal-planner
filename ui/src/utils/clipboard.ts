import { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';
import { DAYS_OF_THE_WEEK } from '@meal-planner/shared';

export function formatMealPlanForClipboard(plan: WeeklyMealPlan): {
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

  DAYS_OF_THE_WEEK.forEach((day, idx) => {
    const entries = plan.days.filter((d) => d.dayIndex === idx);
    if (entries.length === 0) return;

    const mealsHtml = entries
      .filter((e) => e.meal)
      .map((e) => {
        const meal = e.meal!;
        const mealType =
          e.mealType.charAt(0).toUpperCase() + e.mealType.slice(1);
        return `<strong>${mealType}</strong>: ${meal.name} (${meal.effort})`;
      })
      .join('<br>');

    html +=
      `<tr><td style="border:1px solid #ddd;padding:8px;">${day}</td>` +
      `<td style="border:1px solid #ddd;padding:8px;">${mealsHtml}</td></tr>`;

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

export async function copyMealPlanToClipboard(
  plan: WeeklyMealPlan,
): Promise<void> {
  const { html, text } = formatMealPlanForClipboard(plan);
  try {
    // Use rich clipboard when available
    if (
      'ClipboardItem' in globalThis &&
      navigator.clipboard &&
      'write' in navigator.clipboard
    ) {
      const ClipboardItemCtor = (globalThis as any).ClipboardItem as new (
        items: Record<string, Blob>,
      ) => unknown;
      const item = new ClipboardItemCtor({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      await (navigator.clipboard as any).write([item]);
      return;
    }
    await navigator.clipboard.writeText(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}

export async function copyShoppingListToClipboard(
  items: ShoppingListItem[],
): Promise<void> {
  const text = items
    .map((i) =>
      `- ${Number(i.quantity) > 0 ? `${i.quantity} ` : ''}${i.ingredient}`.trim(),
    )
    .join('\n');

  const html = `<ul>${items
    .map((i) => {
      const qty = Number(i.quantity) > 0 ? `${i.quantity} ` : '';
      const cat = i.category ? ` (${i.category})` : '';
      return `<li>${qty}${i.ingredient}${cat}</li>`;
    })
    .join('')}</ul>`;

  try {
    if (
      'ClipboardItem' in globalThis &&
      navigator.clipboard &&
      'write' in navigator.clipboard
    ) {
      const ClipboardItemCtor = (globalThis as any).ClipboardItem as new (
        items: Record<string, Blob>,
      ) => unknown;
      const item = new ClipboardItemCtor({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });

      await (navigator.clipboard as any).write([item]);
      return;
    }

    await navigator.clipboard.writeText(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}
