## UI decomposition: AgentPage

### Goals
- Reduce `ui/src/AgentPage.tsx` size by extracting single‑responsibility components and hooks
- Preserve current UX, behaviors, and test hooks (`data-testid`)
- Follow `ui/CLAUDE.md` (functional components, hooks, MUI theme) and project import rules
- Respect `MASTER_PLAN.md`: API types must come from `@mealplanner/generated`

### Target structure
- `ui/src/pages/AgentPage/AgentPage.tsx` (container; slim)
- `ui/src/pages/AgentPage/components/chat/ChatPanel.tsx`
  - `ChatHeader.tsx`
  - `ChatMessages.tsx`
  - `ChatInput.tsx`
- `ui/src/pages/AgentPage/components/plan/PlanPanel.tsx`
  - `ShareMenu.tsx`
  - `ShoppingListView.tsx`
- `ui/src/pages/AgentPage/hooks/useAgentController.ts`
- `ui/src/hooks/useMealPlanHighlights.ts`
- `ui/src/hooks/useAutoScroll.ts`
- `ui/src/utils/clipboard.ts`
- `ui/src/theme/colors.ts` (or consolidate into `ui/src/theme.tsx`)
- `ui/src/types.ts` (only if shared UI types are needed)

### Responsibilities

- AgentPage (container)
  - Orchestrates hooks, state wiring, and layout composition
  - Holds toast state and meal library toggle
  - Passes props to `ChatPanel` and `PlanPanel`; contains no network logic

- useAgentController (hook)
  - Session lifecycle: start, resume (via `useSession`), logout
  - Messaging flow: input state, send message, disable UI while working
  - Backend sync: fetch messages, checkpoint, convert plan, fetch shopping list
  - Encapsulates calls to `startAgentSession`, `sendAgentMessage`, `getAgentCheckpoint`, `getMessages`, `goGetShoppingList`
  - Returns a clean interface to the container and panels

- useMealPlanHighlights (hook)
  - Detect changed `dayIndex-mealType` pairs vs previous plan, maintain `Set<string>`
  - Auto-clear changed highlights after 5s

- useAutoScroll (hook)
  - Auto-scroll to bottom when `messages` change; returns a `ref`

- ChatPanel (presentational)
  - Left column: header (title, start/logout, meal library), messages list, input area
  - Owns layout/styling; behaviors provided via props

- PlanPanel (presentational)
  - Right column: tab header (Meal Plan / Shopping List) + share menu
  - Displays `MealPlanDisplay` and `ShoppingListView`

- ShareMenu (presentational)
  - Anchored menu that triggers provided copy actions

- ShoppingListView (presentational)
  - Pure render of items with quantity and optional category

- clipboard utils
  - `formatMealPlanForClipboard(plan)` returns `{ html, text }`
  - `copyMealPlanToClipboard(plan)`, `copyShoppingListToClipboard(items)` with HTML+text fallback

- theme/colors
  - Move `colorSchemes` and `getStyles` out of the page
  - Prefer integrating into `ui/src/theme.tsx` to keep a single source of truth

### Props and hook contracts

ChatPanel

```ts
export interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

export interface Colors {
  mainBg: string;
  chatBg: string;
  cardBg: string;
  headerBg: string;
  headerText: string;
  accent: string;
  accent2: string;
  apricot?: string;
  border: string;
  text: string;
  userMsgBg: string;
  aiMsgBg: string;
  changedMealHighlight: string;
}

export interface ChatPanelProps {
  hasSession: boolean;
  isWorking: boolean;
  messages: ChatMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStartSession: () => void;
  onLogout: () => void;
  onOpenMealLibrary: () => void;
  onEnterKey: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  colors: Colors;
}
```

PlanPanel

```ts
import { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';

export interface PlanPanelProps {
  mealPlan: WeeklyMealPlan | null;
  shoppingList: ShoppingListItem[] | null;
  currentTab: number;
  onTabChange: (tab: number) => void;
  highlights: Set<string>;
  onCopyMealPlan: () => void;
  onCopyShoppingList: () => void;
  colors: Colors;
}
```

useAgentController

```ts
import { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';

interface UseAgentController {
  session: SessionInfo | null;
  startSession: () => Promise<void>;
  logout: () => void;

  input: string;
  setInput: (v: string) => void;
  isWorking: boolean;

  messages: ChatMessage[];
  sendMessage: (text?: string) => Promise<{ newPlan?: WeeklyMealPlan } | void>;

  mealPlan: WeeklyMealPlan | null;
  shoppingList: ShoppingListItem[] | null;
}
```

useMealPlanHighlights

```ts
import { WeeklyMealPlan } from '@mealplanner/generated';

function useMealPlanHighlights(currentPlan: WeeklyMealPlan | null): {
  highlights: Set<string>;
  applyHighlights: (newPlan: WeeklyMealPlan) => void;
  resetHighlights: () => void;
} {
  // implementation detail lives in hook file
}
```

clipboard utils

```ts
import { WeeklyMealPlan, ShoppingListItem } from '@mealplanner/generated';

export function formatMealPlanForClipboard(plan: WeeklyMealPlan): { html: string; text: string };
export async function copyMealPlanToClipboard(plan: WeeklyMealPlan): Promise<void>;
export async function copyShoppingListToClipboard(items: ShoppingListItem[]): Promise<void>;
```

### Theming and styles
- Extract `colorSchemes` and `getStyles` to `ui/src/theme/colors.ts` or merge into `ui/src/theme.tsx`
- Continue using MUI system with overrides defined in the theme

### Testing and `data-testid`
- Preserve current `data-testid`s by rendering them in the new components:
  - Chat: `start-session`, `chat-history`, `message-input`, `send-button`, `open-meal-library`
  - Share: `share-menu-button`, `copy-meal-plan`, `copy-shopping-list`
- Keep Enter-to-send and Shift+Enter newline behaviors intact

### Migration plan (low-risk order)
6. Introduce `useAgentController` and migrate session/messaging/shopping list logic; simplify container

### Notes
- Follow `ui/CLAUDE.md` for component/hook style and testing setup
- Use yarn commands; avoid npm
- Keep imports of API types strictly from `@mealplanner/generated`


