import {
  formatMealPlanForClipboard,
  copyMealPlanToClipboard,
  copyShoppingListToClipboard,
} from './clipboard';
import {
  MealPlan,
  MealPlanItem,
  Meal,
  ShoppingListItem,
  MealSlot,
} from '@mealplanner/generated';

describe('clipboard utils', () => {
  function buildPlan(): MealPlan {
    const breakfast = new Meal({ id: 1, name: 'Oatmeal', effort: 1 });
    const dinner = new Meal({ id: 2, name: 'Grilled Chicken', effort: 2 });

    const items: MealPlanItem[] = [
      new MealPlanItem({
        dayIndex: 0,
        mealType: MealSlot.BREAKFAST,
        mealSnapshot: breakfast,
      }),
      new MealPlanItem({
        dayIndex: 0,
        mealType: MealSlot.DINNER,
        mealSnapshot: dinner,
      }),
      new MealPlanItem({
        dayIndex: 1,
        mealType: MealSlot.DINNER,
        mealSnapshot: dinner,
      }),
    ];

    return new MealPlan({ items });
  }

  function mockClipboard() {
    const clip = {
      write: jest.fn().mockResolvedValue(undefined),
      writeText: jest.fn().mockResolvedValue(undefined),
    } as unknown as Clipboard;
    // Define clipboard on existing navigator for jsdom
    Object.defineProperty(navigator, 'clipboard', {
      value: clip,
      configurable: true,
      writable: true,
    });
    return clip;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockClipboard();

    (global as unknown as { ClipboardItem?: unknown }).ClipboardItem = undefined;
  });

  it('formats meal plan into html and text', () => {
    const plan = buildPlan();
    const { html, text } = formatMealPlanForClipboard(plan);

    expect(html).toContain('<table');
    expect(html).toContain('Day');
    expect(html).toContain('Meals');
    expect(html).toContain('Monday');
    expect(html).toContain('Oatmeal');
    expect(html).toContain('Grilled Chicken');

    expect(text).toContain('Day | Meals');
    expect(text).toContain('Monday |');
    expect(text).toContain('breakfast: Oatmeal (1)');
    expect(text).toContain('dinner: Grilled Chicken (2)');
  });

  it('copies meal plan using rich clipboard when ClipboardItem is available', async () => {
    const plan = buildPlan();
    // Provide a fake ClipboardItem constructor

    (global as unknown as { ClipboardItem: typeof ClipboardItem }).ClipboardItem = function FakeClipboardItem(
      this: unknown,
      _items: Record<string, Blob>,
    ) {
      // no-op
    } as unknown as typeof ClipboardItem;

    await copyMealPlanToClipboard(plan);

    const write = (navigator.clipboard as unknown as { write: jest.Mock }).write;
    const writeText = (navigator.clipboard as unknown as { writeText: jest.Mock }).writeText;

    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to plain text when ClipboardItem is not available for meal plan', async () => {
    const plan = buildPlan();

    await copyMealPlanToClipboard(plan);

    const write = (navigator.clipboard as unknown as { write: jest.Mock }).write;
    const writeText = (navigator.clipboard as unknown as { writeText: jest.Mock }).writeText;

    expect(write).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Day | Meals'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Monday |'));
  });

  it('copies shopping list with rich clipboard when available', async () => {
    const items = [
      new ShoppingListItem({
        ingredient: 'Milk',
        quantity: '2',
        category: 'Dairy',
      }),
      new ShoppingListItem({ ingredient: 'Eggs', quantity: '', category: '' }),
    ];

    (global as unknown as { ClipboardItem: typeof ClipboardItem }).ClipboardItem = function FakeClipboardItem(
      this: unknown,
      _items: Record<string, Blob>,
    ) {
      // no-op
    } as unknown as typeof ClipboardItem;

    await copyShoppingListToClipboard(items);

    const write = ((navigator.clipboard as unknown) as { write: jest.Mock }).write;
    const writeText = ((navigator.clipboard as unknown) as { writeText: jest.Mock }).writeText;

    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to plain text for shopping list when ClipboardItem is not available', async () => {
    const items = [
      new ShoppingListItem({ ingredient: 'Milk', quantity: '2' }),
      new ShoppingListItem({ ingredient: 'Eggs', quantity: '' }),
    ];

    await copyShoppingListToClipboard(items);

    const write = ((navigator.clipboard as unknown) as { write: jest.Mock }).write;
    const writeText = ((navigator.clipboard as unknown) as { writeText: jest.Mock }).writeText;

    expect(write).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('- 2 Milk'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('- Eggs'));
  });
});
