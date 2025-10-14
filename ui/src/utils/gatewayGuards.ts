import {
  Meal,
  MealPlan,
  MealPlanEntry,
  MealPlanningCheckpointState,
  MealSlot,
  ShoppingList,
  ShoppingListItem,
} from '@mealplanner/generated/api_pb';
import type { JsonValue } from '@bufbuild/protobuf';
import type {
  GoGetCheckpointResponse,
  GoGetMessagesResponse,
  GoGetShoppingListResponse,
  GoMeal,
  GoMessageAgentResponse,
  GoStartAgentWorkflowResponse,
} from '@mealplanner/generated/gateway/types.gen';

export interface AgentResponsePayload {
  threadId?: string;
  currentStep?: string;
  message?: string;
  initialState?: string;
}

export interface AgentStartPayload extends AgentResponsePayload {
  threadId: string;
  currentStep: string;
}

export interface AgentMessage {
  sender: 'user' | 'agent';
  content: string;
  createdAt?: string;
  threadId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeParseJson(value: string, context: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${context}: ${message}`);
  }
}

function getProperty(record: unknown, key: string): unknown {
  if (!isRecord(record)) {
    return undefined;
  }
  return record[key];
}

function normalizeAgentResponse(
  payload: unknown,
  context: string,
): AgentResponsePayload {
  if (payload == null) {
    throw new Error(`${context} missing response payload`);
  }

  const source =
    typeof payload === 'string'
      ? safeParseJson(payload, `${context} response`)
      : payload;

  if (!isRecord(source)) {
    throw new Error(`${context} response was not an object`);
  }

  const threadIdValue = getProperty(source, 'threadId');
  const currentStepValue = getProperty(source, 'currentStep');
  const messageValue = getProperty(source, 'message');
  const initialStateValue = getProperty(source, 'initialState');

  return {
    threadId:
      typeof threadIdValue === 'string' && threadIdValue.trim().length > 0
        ? threadIdValue
        : undefined,
    currentStep:
      typeof currentStepValue === 'string' && currentStepValue.trim().length > 0
        ? currentStepValue
        : undefined,
    message:
      typeof messageValue === 'string' && messageValue.length > 0
        ? messageValue
        : undefined,
    initialState:
      typeof initialStateValue === 'string' && initialStateValue.length > 0
        ? initialStateValue
        : undefined,
  };
}

export function parseAgentStartResponse(
  data: GoStartAgentWorkflowResponse | undefined,
): AgentStartPayload {
  if (!data) {
    throw new Error('Agent start response was empty');
  }

  const envelopeRaw: unknown =
    typeof data === 'string'
      ? safeParseJson(data, 'Agent start response')
      : data;

  if (!isRecord(envelopeRaw)) {
    throw new Error('Agent start response was not an object');
  }

  const responsePayload = getProperty(envelopeRaw, 'response');
  const response = normalizeAgentResponse(
    responsePayload,
    'Agent start response',
  );

  const { threadId, currentStep, message, initialState } = response;
  if (!threadId || !currentStep) {
    throw new Error('Agent start response missing required fields');
  }

  return {
    threadId,
    currentStep,
    message,
    initialState,
  } satisfies AgentStartPayload;
}

export function parseAgentMessageResponse(
  data: GoMessageAgentResponse | undefined,
): AgentResponsePayload {
  if (!data) {
    throw new Error('Agent message response was empty');
  }

  const envelopeRaw: unknown =
    typeof data === 'string'
      ? safeParseJson(data, 'Agent message response')
      : data;

  if (!isRecord(envelopeRaw)) {
    throw new Error('Agent message response was not an object');
  }

  const payload = getProperty(envelopeRaw, 'response');
  return normalizeAgentResponse(payload, 'Agent message response');
}

export function parseCheckpointState(
  value: unknown,
  context: string,
): MealPlanningCheckpointState | undefined {
  if (value == null) {
    return undefined;
  }

  const source =
    typeof value === 'string' ? safeParseJson(value, context) : value;

  try {
    return MealPlanningCheckpointState.fromJson(source as JsonValue, {
      ignoreUnknownFields: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse checkpoint state: ${message}`);
  }
}

export function parseCheckpointResponse(
  value: GoGetCheckpointResponse | undefined,
): MealPlanningCheckpointState | undefined {
  if (!value) {
    return undefined;
  }

  const tupleSource = getProperty(value, 'tuple');
  if (!tupleSource) {
    return undefined;
  }

  const tupleRaw: unknown =
    typeof tupleSource === 'string'
      ? safeParseJson(tupleSource, 'checkpoint tuple')
      : tupleSource;

  if (!isRecord(tupleRaw)) {
    throw new Error('Checkpoint tuple was not an object');
  }

  const checkpointSource = getProperty(tupleRaw, 'checkpoint');
  if (!checkpointSource) {
    return undefined;
  }

  const checkpointRaw: unknown =
    typeof checkpointSource === 'string'
      ? safeParseJson(checkpointSource, 'checkpoint payload')
      : checkpointSource;

  if (!isRecord(checkpointRaw)) {
    throw new Error('Checkpoint payload was not an object');
  }

  return parseCheckpointState(getProperty(checkpointRaw, 'state'), 'checkpoint state');
}

export function parseMealPlan(plan: unknown): MealPlan {
  if (plan instanceof MealPlan) {
    return plan;
  }

  if (plan == null) {
    return new MealPlan({ items: [] });
  }

  const source: unknown =
    typeof plan === 'string' ? safeParseJson(plan, 'meal plan') : plan;

  if (!isRecord(source)) {
    throw new Error('Meal plan payload was not an object');
  }

  try {
    return MealPlan.fromJson(source as JsonValue, {
      ignoreUnknownFields: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse meal plan: ${message}`);
  }
}

export function parseMealPlanFromCheckpoint(
  state: MealPlanningCheckpointState | undefined,
): MealPlan | undefined {
  if (!state?.mealPlan) {
    return undefined;
  }
  return parseMealPlan(state.mealPlan);
}

export function parseShoppingListResponse(
  value: GoGetShoppingListResponse | undefined,
): ShoppingListItem[] {
  if (!value) {
    return [];
  }

  const source: unknown =
    typeof value === 'string'
      ? safeParseJson(value, 'shopping list response')
      : value;

  if (!isRecord(source)) {
    throw new Error('Shopping list response was not an object');
  }

  const items = getProperty(source, 'items');
  if (!Array.isArray(items)) {
    throw new Error('Shopping list response missing items array');
  }

  return items.map((entry, index) => {
    const entrySource: unknown =
      typeof entry === 'string'
        ? safeParseJson(entry, `shopping list entry #${index}`)
        : entry;

    if (!isRecord(entrySource)) {
      throw new Error('Shopping list entry was not an object');
    }

    const ingredientValue = getProperty(entrySource, 'ingredient');
    const quantityValue = getProperty(entrySource, 'quantity');
    const categoryValue = getProperty(entrySource, 'category');

    return new ShoppingListItem({
      ingredient:
        typeof ingredientValue === 'string' ? ingredientValue : '',
      quantity: typeof quantityValue === 'string' ? quantityValue : '',
      category: typeof categoryValue === 'string' ? categoryValue : '',
    });
  });
}

export function parseMessagesResponse(
  value: GoGetMessagesResponse | undefined,
): AgentMessage[] {
  if (!value) {
    return [];
  }

  const source: unknown =
    typeof value === 'string'
      ? safeParseJson(value, 'messages response')
      : value;

  if (!isRecord(source)) {
    throw new Error('Messages response was not an object');
  }

  const messages = getProperty(source, 'messages');
  if (!Array.isArray(messages)) {
    throw new Error('Messages payload must be an array');
  }

  return messages.map((entry, index) => {
    const entrySource: unknown =
      typeof entry === 'string'
        ? safeParseJson(entry, `message entry #${index}`)
        : entry;

    if (!isRecord(entrySource)) {
      throw new Error('Message entry was not an object');
    }

    const senderValue = getProperty(entrySource, 'sender');
    const primaryContent = getProperty(entrySource, 'content');
    const fallbackContent = getProperty(entrySource, 'message');
    const contentValue =
      typeof primaryContent === 'string'
        ? primaryContent
        : typeof fallbackContent === 'string'
          ? fallbackContent
          : '';

    const sender = senderValue === 'user' ? 'user' : 'agent';

    const createdAtValue = getProperty(entrySource, 'createdAt');
    const threadIdValue = getProperty(entrySource, 'threadId');

    return {
      sender,
      content: contentValue,
      createdAt: typeof createdAtValue === 'string' ? createdAtValue : undefined,
      threadId: typeof threadIdValue === 'string' ? threadIdValue : undefined,
    };
  });
}

export function mapGatewayMealToProto(meal: GoMeal | undefined): Meal | undefined {
  if (!meal) {
    return undefined;
  }
  if (meal instanceof Meal) {
    return meal;
  }
  try {
    return Meal.fromJson(meal as JsonValue, {
      ignoreUnknownFields: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse meal: ${message}`);
  }
}

export function planToEntries(plan?: MealPlan | null): MealPlanEntry[] {
  if (!plan) {
    return [];
  }

  const entries: MealPlanEntry[] = [];

  for (const item of plan.items) {
    const slot =
      typeof item.mealType === 'number' ? item.mealType : MealSlot.UNSPECIFIED;
    const dayIndex = item.dayIndex >= 0 ? item.dayIndex : 0;
    const mealSnapshot = mapGatewayMealToProto(item.mealSnapshot);
    const mealId = typeof item.mealId === 'number' && item.mealId > 0 ? item.mealId : undefined;
    const meal =
      mealSnapshot ??
      (mealId !== undefined
        ? new Meal({
            id: mealId,
          })
        : undefined);

    entries.push(
      new MealPlanEntry({
        dayIndex,
        mealType: mealSlotToKey(slot),
        meal,
      }),
    );
  }

  return entries.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) {
      return a.dayIndex - b.dayIndex;
    }
    return mealTypeOrder(a.mealType) - mealTypeOrder(b.mealType);
  });
}

function mealSlotToKey(slot: MealSlot): string {
  switch (slot) {
    case MealSlot.BREAKFAST:
      return 'breakfast';
    case MealSlot.LUNCH:
      return 'lunch';
    case MealSlot.DINNER:
      return 'dinner';
    default:
      return 'unspecified';
  }
}

function mealTypeOrder(type: string): number {
  switch (type) {
    case 'breakfast':
      return 0;
    case 'lunch':
      return 1;
    case 'dinner':
      return 2;
    default:
      return 3;
  }
}

export function formatGatewayError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (isRecord(err) && 'error' in err) {
    return formatGatewayError(err.error);
  }
  if (err != null) {
    return JSON.stringify(err);
  }
  return 'Unknown error';
}

export function toShoppingList(
  items: ShoppingListItem[],
): ShoppingList | undefined {
  if (items.length === 0) {
    return undefined;
  }
  return new ShoppingList({ items });
}
