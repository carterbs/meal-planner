MCP Refactor Milestone 1 — Hand‑Off Notes
=========================================

Current Snapshot
----------------
- Back-end and MCP layers speak the new `MealPlan` schema: proto, Go handlers, migrations, and MCP tools are wired to `MealPlan.items` + `MealSlot`.
- Front-end imports have been pointed at the regenerated gateway/Buf packages, but UI build still fails because we have not cleaned up the TypeScript `no-unsafe-*` lint violations around gateway payloads.
- `generated/ts/package.json` now exposes richer `exports`/`typesVersions`; this unblocks consumers but requires the UI side to consume the surfaced typings correctly.

What’s Done
-----------
- Repositories, gRPC server, and MCP tooling all persist and retrieve normalized meal plans; unit tests cover inserts, upserts, migrations, and enum handling.
- Agent-service test utilities produce `MealPlanItem` fixtures, and workflows interact with snapshots rather than legacy structures.
- `@mealplanner/generated` exports were adjusted to surface both JS and d.ts pairs per module.
- Type imports across the UI were updated (where low-risk) to use `@mealplanner/generated/...` instead of the deprecated `dist/gateway` deep paths.

Outstanding Work (UI / Type Safety)
-----------------------------------
1. **Gateway response guards.**
   - Implement runtime type guards or dedicated mappers that convert the loose gateway responses (`postAgentStart`, `postAgentMessage`, `getCheckpointsByThreadId`, `postShoppinglist`, etc.) into strongly typed objects.
   - Replace ad-hoc casts in `ui/src/api/agentApi.ts`, `ui/src/api/mealsApi.ts`, `ui/src/hooks/useSession.ts`, and related tests with these helpers.

2. **UI controller + hook cleanup.**
   - `useAgentController`, `useAgentMealSync`, and `useMealPlanHighlights` still operate on partially typed data. They should consume the new helpers so all state updates use validated `MealPlan`/`ShoppingListItem` objects.
   - Once state is typed, the lint errors (`no-unsafe-*`, `no-unnecessary-condition`) should disappear without disabling rules.

3. **Meal plan utilities.**
   - Update `mealPlanUtils.ts`, `mealPlanConverter.ts`, and `clipboard.ts` to rely on the shared helpers instead of operating on raw (possibly `any`) entries. Ensure `planToEntries` handles undefined items gracefully but returns fully typed entries.

4. **Final validation.**
   - After refactors, rerun:
     ```
     ./tools/validate/validate lint --json --no-spinner
     ./tools/validate/validate build --json --no-spinner
     ./tools/validate/validate test --json --no-spinner
     ```
   - CI should pass once the UI build succeeds; no other services are currently blocking.

Recommended Approach
--------------------
1. Add helper modules (e.g., `ui/src/utils/gatewayGuards.ts`) that:
   - Narrow `PostAgentStartResponses` → `{ response: { threadId, currentStep, initialState?, message? } }`.
   - Narrow `PostAgentMessageResponses`, `GetCheckpointsByThreadIdResponses`, and `PostShoppinglistResponses`.
   - Export small functions like `extractAgentStart(result)` and `extractShoppingList(result)` returning typed data or throwing.
2. Refactor API wrappers to use those helpers, removing casts.
3. Propagate the typed shapes through hooks/components, replacing optional chaining with explicit checks on validated fields.
4. Re-run the UI build; expect lint to pass once everything is typed.

Residual Risks
--------------
- The `generated/ts` package now exposes additional export entries; if further consumers use deep paths, ensure they are updated to the new exports before publishing.
- Any future proto changes must regenerate TS/Go stubs and rerun the helper guards to keep parity.

Environment / Validation Notes
------------------------------
- Tests and lint succeed for meal-service, agent-service, and MCP service (`./tools/validate/validate test|lint` already green).
- `./tools/validate/validate build` currently fails only because the UI lint gate refuses to process the unsafe access patterns described above.

Next Agent Checklist
--------------------
1. Create response guard helpers and refactor `agentApi`, `mealsApi`, `useSession`, and hooks to use them.
2. Update related tests to exercise the guards instead of relying on jest mocks returning loosely typed objects.
3. Ensure `mealPlanUtils` and `mealPlanHighlights` operate on typed entries (derive IDs safely).
4. Run full validate suite; once green, the milestone can be marked complete.
