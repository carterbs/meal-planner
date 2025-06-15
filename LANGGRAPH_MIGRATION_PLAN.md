# Plan: Transform Meal Planner Agent into Multi-Workflow LangGraph System

## Overview
Convert the current CLI-based meal planning agent into an asynchronous, multi-workflow system using LangGraph that supports:
- **Multiple workflow types**: Meal planning, recipe management, ingredient management
- Multi-turn conversations with you and your wife for meal plan iteration
- Persistent state management with PostgreSQL checkpoints
- Generic I/O interfaces (CLI now, email later)
- Complete meal planning workflow ending with shopping list generation
- There are instructions in this file for after v0. They are for the human, not you.

## Architecture Changes

### 1. Multi-Workflow LangGraph Architecture
**Separate workflows for different use cases:**

#### Meal Planning Workflow (Primary - v0 Focus)
- **Nodes**: `initiate` → `generate_plan` → `present_plan` → `await_feedback` → `process_feedback` → `optimize_plan` → `finalize_plan` → `generate_shopping_list` → `complete`
- **State**: Persistent conversation state including meal plans, all feedback history, iteration count
- **Interrupts**: Pause at each feedback step for human input from brad/shannon

#### Recipe Management Workflow (Post-V0)
- **Nodes**: `initiate` → `validate_recipe` → `save_recipe` → `confirm` → `complete`
- **State**: Recipe data, validation errors, ingredient mappings
- **Interrupts**: Pause for recipe validation and confirmation

#### Ingredient Management Workflow (Post-v0)
- **Nodes**: `initiate` → `process_ingredient_action` → `validate_changes` → `confirm` → `complete`  
- **State**: Ingredient data, substitution mappings, validation results
- **Interrupts**: Pause for change confirmation

**Shared Components:**
- **Checkpoints**: PostgreSQL-based persistence for all workflow types
- **I/O Handlers**: Generic communication layer across workflows
- **MCP Integration**: All workflows use existing MCP server tools

### 2. Persistent State Management  
**PostgreSQL checkpointing:**
- Create new `workflow_checkpoints` table in existing database
- Store workflow state for all workflow types with polymorphic design
- Thread-based conversations with unique IDs for each workflow session
- Workflow type identification for proper state restoration
- Support for multiple participants (brad + shannon) in meal planning workflows

### 3. Generic I/O Interface Design
**Abstracted communication layer:**
- `IOHandler` interface with implementations for CLI and future email
- `CLIHandler`: Terminal-based input/output for v0
- `EmailHandler`: Future email-based communication (not implemented in v0)
- Message formatting that works across both interfaces

### 4. Multi-Workflow Scope
**Meal Planning Workflow (v0 Priority):**
- Initial meal plan generation using existing MCP tools and current optimization logic
- Multi-turn feedback collection and plan refinement
- Meal plan finalization and confirmation
- Shopping list generation using existing MCP tools
- Final delivery of complete meal plan + shopping list

**Recipe Management Workflow (Future):**
- Add new recipes with ingredients and steps
- Edit existing recipes
- Delete recipes with dependency checking
- Recipe validation and formatting

**Ingredient Management Workflow (Future):**
- Add/edit/delete ingredients
- Manage ingredient substitutions
- Update ingredient categories and properties
- Bulk ingredient operations

## Implementation Steps

<important>At each step (NOTE: not phase. Each step.), commit your work following the guidance for the /commit slash command.</important>

### Phase 1: Multi-Workflow Foundation
1. Create PostgreSQL checkpoint table with workflow type support
2. Set up LangGraph with PostgreSQL checkpointer
3. Define base workflow architecture and shared types
4. Create workflow registry and factory pattern

### Phase 2: Meal Planning Workflow (v0 Focus)
- [x] Convert existing agent logic to meal planning LangGraph nodes
- [ ] Implement feedback collection and processing nodes
- [x] Add shopping list generation node using existing MCP tools
- [ ] Create multi-turn conversation handling for meal planning

### Phase 3: Generic I/O Layer
1. Design `IOHandler` interface for pluggable communication
2. Implement `CLIHandler` for terminal-based interaction
3. Add message formatting and participant management
4. Create session management for resumable conversations

### Phase 4: CLI Interface & Testing
1. Build multi-workflow CLI commands
2. Add comprehensive tests for meal planning workflow
3. Test multi-turn conversations and state persistence
4. Integration testing with existing MCP server

### Phase 5: Future Workflow Foundation (Post-v0)
1. Create recipe management workflow structure
2. Create ingredient management workflow structure
3. Extend CLI commands for new workflows
4. Add tests for all workflow types

## Technical Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   CLI Commands  │───▶│ WorkflowManager  │───▶│  Workflow Registry  │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                │                          │
                                ▼                          ▼
                       ┌──────────────────┐    ┌─────────────────────┐
                       │ PostgreSQL       │    │   LangGraph         │
                       │ Checkpoints      │    │   Workflows         │
                       └──────────────────┘    └─────────────────────┘
                                │                          │
                                ▼                          ▼
                       ┌──────────────────┐    ┌─────────────────────┐
                       │ Generic IOHandler│    │   MCP Server        │
                       │ (CLI → Email)    │    │   (existing)        │
                       └──────────────────┘    └─────────────────────┘

Workflow Types:
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  Meal Planning      │  │  Recipe Management  │  │ Ingredient Mgmt     │
│  Workflow           │  │  Workflow (Future)  │  │ Workflow (Future)   │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

## Multi-Workflow State Schema

```typescript
enum WorkflowType {
  MEAL_PLANNING = 'meal_planning',
  RECIPE_MANAGEMENT = 'recipe_management',
  INGREDIENT_MANAGEMENT = 'ingredient_management'
}

interface BaseWorkflowState {
  thread_id: string;
  workflow_type: WorkflowType;
  participants: string[];
  created_at: Date;
  updated_at: Date;
  current_step: string;
}

interface MealPlanningState extends BaseWorkflowState {
  workflow_type: WorkflowType.MEAL_PLANNING;
  meal_plan: WeeklyMealPlan | null;
  feedback_history: FeedbackEntry[];
  iteration_count: number;
  shopping_list: ShoppingItem[] | null;
  is_finalized: boolean;
  current_step: MealPlanningStep;
}

interface RecipeManagementState extends BaseWorkflowState {
  workflow_type: WorkflowType.RECIPE_MANAGEMENT;
  recipe_action: 'create' | 'update' | 'delete';
  recipe_data: RecipeData | null;
  validation_errors: string[];
  current_step: RecipeManagementStep;
}

interface IngredientManagementState extends BaseWorkflowState {
  workflow_type: WorkflowType.INGREDIENT_MANAGEMENT;
  ingredient_action: 'create' | 'update' | 'delete' | 'substitute';
  ingredient_data: IngredientData | null;
  substitution_data: SubstitutionData | null;
  validation_errors: string[];
  current_step: IngredientManagementStep;
}

interface FeedbackEntry {
  from: string; // 'brad' or 'shannon'
  message: string;
  timestamp: Date;
  meal_plan_version: number;
}

enum MealPlanningStep {
  INITIATE = 'initiate',
  GENERATE_PLAN = 'generate_plan', 
  PRESENT_PLAN = 'present_plan',
  AWAIT_FEEDBACK = 'await_feedback',
  PROCESS_FEEDBACK = 'process_feedback',
  OPTIMIZE_PLAN = 'optimize_plan',
  FINALIZE_PLAN = 'finalize_plan',
  GENERATE_SHOPPING_LIST = 'generate_shopping_list',
  COMPLETE = 'complete'
}

enum RecipeManagementStep {
  INITIATE = 'initiate',
  VALIDATE_RECIPE = 'validate_recipe',
  SAVE_RECIPE = 'save_recipe',
  CONFIRM = 'confirm',
  COMPLETE = 'complete'
}

enum IngredientManagementStep {
  INITIATE = 'initiate',
  PROCESS_INGREDIENT_ACTION = 'process_ingredient_action',
  VALIDATE_CHANGES = 'validate_changes',
  CONFIRM = 'confirm',
  COMPLETE = 'complete'
}

interface ShoppingItem {
  ingredient: string;
  quantity: string;
  category?: string;
}

interface RecipeData {
  id?: number;
  name: string;
  ingredients: string[];
  steps: string[];
  meal_type: string;
  effort: number;
}

interface IngredientData {
  id?: number;
  name: string;
  category?: string;
  properties?: Record<string, any>;
}

interface SubstitutionData {
  from_ingredient: string;
  to_ingredient: string;
  ratio?: number;
  notes?: string;
}
```

## CLI Commands for Multi-Workflow System

### v0 Commands (Meal Planning Focus)
```bash
# Meal planning workflow
meal-agent plan start                           # Start new meal planning session
meal-agent plan status                          # Check status of current meal planning session  
meal-agent plan feedback "I don't like salmon" # Provide feedback to current session
meal-agent plan finalize                        # Finalize current meal plan and get shopping list

# General workflow management
meal-agent status                               # Show all active workflows
meal-agent resume <thread_id>                   # Resume any paused workflow
meal-agent list                                 # List all workflows (all types)
meal-agent cancel <thread_id>                   # Cancel a workflow
```

### Future Commands (Post-v0)
```bash
# Recipe management workflow
meal-agent recipe add "Chicken Parmesan"       # Start workflow to add new recipe
meal-agent recipe edit <recipe_name>              # Start workflow to edit recipe. Agent searches for the closest recipe and then
meal-agent recipe delete <recipe_name>            # Start workflow to delete recipe

# Ingredient management workflow  
meal-agent ingredients edit "Chicken Parmesan" # drop into chat session to edit ingredients
```

## Database Changes

**New table: `workflow_checkpoints`**
```sql
CREATE TABLE workflow_checkpoints (
  thread_id VARCHAR(255) PRIMARY KEY,
  workflow_type VARCHAR(50) NOT NULL,
  checkpoint_ns VARCHAR(255) NOT NULL,
  checkpoint_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_workflow_checkpoints_type ON workflow_checkpoints(workflow_type);
CREATE INDEX idx_workflow_checkpoints_ns ON workflow_checkpoints(checkpoint_ns);
CREATE INDEX idx_workflow_checkpoints_created ON workflow_checkpoints(created_at);
CREATE INDEX idx_workflow_checkpoints_type_created ON workflow_checkpoints(workflow_type, created_at);
```

## Key Benefits
- **Multi-workflow**: Supports meal planning, recipe management, and ingredient management
- **Multi-participant**: Both brad and shannon can provide feedback in meal planning workflows
- **Iterative**: Supports multiple rounds of plan refinement
- **Complete**: Handles entire flow from generation to shopping list
- **Resumable**: All workflows persist across sessions and system restarts
- **Extensible**: Generic I/O design ready for email integration
- **Scalable**: Clean separation allows independent development of workflow types
- **Integrated**: Uses existing MCP server and database infrastructure

## Files to Create/Modify

### New Files
**Core Infrastructure:**
- `agent/shared/types.ts` - Base workflow types and interfaces
- `agent/shared/checkpointer.ts` - PostgreSQL checkpointer implementation
- `agent/shared/io/handler.ts` - Generic I/O handler interface
- `agent/shared/io/cli-handler.ts` - CLI implementation
- `agent/shared/io/email-handler.ts` - Future email implementation (stub)
- `agent/manager.ts` - Multi-workflow lifecycle management
- `agent/registry.ts` - Workflow registry and factory
- `agent/cli.ts` - Multi-workflow CLI command interface

**Meal Planning Workflow (v0 Priority):**
- `agent/workflows/meal-planning/workflow.ts` - Meal planning LangGraph workflow
- `agent/workflows/meal-planning/state.ts` - Meal planning state management
- `agent/workflows/meal-planning/nodes/` - Meal planning workflow nodes
  - `generate-plan.ts`
  - `present-plan.ts`
  - `process-feedback.ts`
  - `optimize-plan.ts`
  - `generate-shopping-list.ts`

**Future Workflows (Post-v0):**
- `agent/workflows/recipe-management/workflow.ts` - Recipe management workflow
- `agent/workflows/recipe-management/state.ts` - Recipe state management
- `agent/workflows/recipe-management/nodes/` - Recipe workflow nodes
- `agent/workflows/ingredient-management/workflow.ts` - Ingredient management workflow
- `agent/workflows/ingredient-management/state.ts` - Ingredient state management
- `agent/workflows/ingredient-management/nodes/` - Ingredient workflow nodes

**Build & Config:**
- `scripts/meal-agent` - CLI entry point script
- `agent/package.json` - Dependencies for LangGraph agent
- `agent/tsconfig.json` - TypeScript configuration

### Database Migrations
- `backend/migrations/006_create_workflow_checkpoints.up.sql`
- `backend/migrations/006_create_workflow_checkpoints.down.sql`

### Tests
**Core Infrastructure Tests:**
- `agent/__tests__/shared/checkpointer.test.ts`
- `agent/__tests__/shared/io/cli-handler.test.ts`
- `agent/__tests__/manager.test.ts`
- `agent/__tests__/registry.test.ts`

**Meal Planning Tests (v0):**
- `agent/__tests__/workflows/meal-planning/workflow.test.ts`
- `agent/__tests__/workflows/meal-planning/state.test.ts`
- `agent/__tests__/workflows/meal-planning/nodes/`

**Future Workflow Tests:**
- `agent/__tests__/workflows/recipe-management/`
- `agent/__tests__/workflows/ingredient-management/`

**Integration Tests:**
- `agent/__tests__/integration/end-to-end.test.ts`
- `agent/__tests__/integration/mcp-integration.test.ts`

## Dependencies to Add

```json
{
  "dependencies": {
    "@langchain/langgraph": "latest",
    "pg": "^8.11.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/pg": "^8.10.0",
    "@types/uuid": "^9.0.0"
  }
}
```

## Future Enhancements (Post-v0)

- Email-based communication with structured templates
- Calendar export integration