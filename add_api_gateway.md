# Add API Gateway – Incremental Refactor Plan

> Goal: Introduce a protobuf-based contract shared across **backend**, **frontend**, **agent**, and **MCP server**, then stand up a thin **API Gateway** on port **8080** that proxies to the refactored backend on **8090**.  
> At the end of **every numbered Step** all existing **e2e tests must be passing**.  The steps are therefore intentionally small.

---

## Background & Architecture Context

### Current System Architecture
- **Backend**: Go service on port 8080 with REST endpoints (`backend/main.go`, `handlers/`)
- **Frontend**: React TypeScript UI (`typescript/ui/`) consuming REST APIs
- **Agent**: TypeScript workflow engine (`typescript/agent/`) for meal planning automation
- **MCP Server**: TypeScript MCP server (`typescript/mcp/`) providing Claude integration
- **Database**: PostgreSQL with migrations and models in `backend/models/`

### Current API Structure
The backend exposes REST endpoints organized in these categories:
- **Health**: `/api/health`, `/api/reconnect`
- **Meal Plans**: `/api/mealplan/*` (get, generate, finalize, ICS export)
- **Shopping Lists**: `/api/shoppinglist`
- **Meals**: `/api/meals/*` (CRUD, swap, remove, replace, ingredients)
- **Recipe Steps**: `/api/meals/{id}/steps/*` (CRUD, reorder)
- **Agent Workflows**: `/api/agent/*` (start, message, status)
- **Workflow Management**: `/api/workflows/*` (state, abandon, messages)

### Data Models
Key entities include:
- `Meal`: Core recipe with ingredients, steps, effort rating, meal type
- `WeeklyMealPlan`: Array of 21 `PlanDay` entries (7 days × 3 meals)
- `ShoppingListItem`: Aggregated ingredients with quantities
- `Agent*Request/Response`: Workflow communication payloads
- All models maintain JSON compatibility for existing clients

### Why Protobuf + API Gateway?
1. **Type Safety**: Shared contract prevents API drift between services
2. **Code Generation**: Eliminates manual type definitions across Go/TypeScript
3. **Gateway Benefits**: Centralized logging, auth, rate limiting, circuit breaking
4. **Incremental Migration**: Each step maintains backward compatibility

---

## Prerequisites
1. All tests currently pass (`yarn test:e2e`).
2. Docker (or Podman) installed – the gateway will eventually run in its own container.
3. `protoc` ≥ 3.22 and plugins:
   * `protoc-gen-go` (install: `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest`)
   * `protoc-gen-go-grpc` (install: `go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest`)
   * `ts-proto` (install: `yarn add -D ts-proto`)
4. Add the following yarn workspaces if not present:
   * `generated` – root-level folder with `go/` and `ts/` subpackages (TS published as `@mealplanner/generated`)

### Implementation Notes
- Ensure `$HOME/go/bin` is in your PATH for Go protobuf plugins
- The `proto:gen` script includes PATH setup: `export PATH=$PATH:$HOME/go/bin`
- Proto definitions use `google.protobuf.Timestamp` for time fields and `google.protobuf.Empty` for parameterless endpoints
- Field names in proto messages exactly match existing JSON field names to maintain API compatibility
- All existing REST endpoints are mapped to corresponding protobuf service methods

---

## Step 0 - Establish a clean baseline
1. `yarn install && yarn format && yarn test:e2e` – ✅ all green.
---

## Step 1 - Introduce Protobuf definitions (no code uses them yet) ✅ COMPLETED
1. ✅ Create `proto/api.proto` with message & service definitions equivalent to every REST endpoint in `backend.go`.
   * Keep field names/KVs identical so JSON shape stays stable.
2. ✅ Add a **code-gen script**:  
   `package.json` →
   ```json
   "scripts": {
     "proto:gen": "export PATH=$PATH:$HOME/go/bin && protoc -I=proto proto/*.proto \\
       --go_out=./generated/go --go_opt=paths=source_relative \\\
       --go-grpc_out=./generated/go --go-grpc_opt=paths=source_relative \\\
       --plugin=./node_modules/ts-proto/protoc-gen-ts_proto --ts_proto_out=./generated/ts"
   }
   ```
3. ✅ Run `yarn proto:gen` – verify files appear.
4. ✅ **No production code changed yet → e2e tests should still pass**.  
   `yarn test:e2e` → ✅
5. ✅ Commit: `feat(proto): add proto contract & generation pipeline`.

---

## Step 2 - Backend consumes generated Go types
1. `backend/go.mod` → add module import for generated GRPC packages (they live under `generated/go/apipb`).
2. In `backend/backend.go`:
   * Replace hand-rolled request/response structs with `apipb.*` equivalents.
   * Implement helper conversion funcs **only where naming mismatches exist** – keep endpoint behaviour identical.
3. Update imports & fix compile errors (`go vet ./...`).
4. Run unit tests & `yarn test:e2e`.  If any fail, patch until green.
5. Commit: `refactor(backend): use proto-generated types`.

---

## Step 3 - Frontend consumes generated TS types 🔄 IN PROGRESS
1. ✅ Add the `generated` workspace to Yarn and declare it as a dependency of the UI package:
   ```json
   "dependencies": {
     "@mealplanner/generated": "*"
   }
   ```
   Then add a `references` entry in `tsconfig.json` (and in the UI-specific `tsconfig.json` if it exists) that points to `"./generated/ts/tsconfig.json"`.  No `compilerOptions.paths` mapping is needed because Node resolution will locate the package automatically.
2. ✅ Replace any ad-hoc request/response type declarations in `typescript/frontend` with imports from `@mealplanner/generated`.
   - Updated `typescript/ui/src/types.ts` to re-export all proto-generated types
   - Updated component imports in `MealPlanDisplay.tsx`, `MealPlanTab.tsx`, `AgentPage.tsx`
   - Updated `AddRecipeForm.tsx` to use proto field names (`name`, `effort`, `hasRedMeat` instead of `mealName`, `relativeEffort`, `redMeat`)
3. 🔄 CURRENT: Ensure API calls encode/decode via generated types (ts-proto exposes `.fromJSON` / `.toJSON` helpers).
   - Need to finish updating remaining field name references in `AddRecipeForm.tsx`
   - Need to check other components for similar field name mismatches
   - Need to update API calls to use proper serialization/deserialization
4. ⏳ NEXT: Run `yarn lint && yarn typecheck`.
5. ⏳ NEXT: `yarn test:e2e` → ✅
6. ⏳ NEXT: Commit: `refactor(frontend): use proto-generated types`.

### Current Status:
- **Progress**: ~70% complete
- **Completed**: Workspace setup, type imports, basic field name updates
- **In Progress**: Finishing field name updates in `AddRecipeForm.tsx` (line 419: `disabled={loading || meal.mealName === ''}` needs to be updated to `meal.name`)
- **Next**: Complete remaining field updates, verify API serialization patterns, run tests

### Known Issues to Address:
1. One remaining field reference in `AddRecipeForm.tsx` needs updating
2. Need to verify all components use consistent field names from proto types
3. May need to update API request/response handling to use `.fromJSON()` / `.toJSON()` helpers

---

## Step 4 - Agent layer adopts proto types
1. Update `typescript/agent` imports to read from `@mealplanner/generated`.
2. Remove custom `formatMealPlan.ts` interfaces if duplicated by proto.
3. Adjust workflow logic accordingly and run unit tests.
4. `yarn test:e2e` – should remain green.
5. Commit: `refactor(agent): proto types`.

---

## Step 5 - MCP server speaks proto
1. In `mcp-server` codebase, import Go generated packages.
2. Replace HTTP client payload structs with proto equivalents.
3. Ensure any gRPC or REST marshaling uses `protojson`.
4. `go test ./...` then `yarn test:e2e` → ✅
5. Commit: `refactor(mcp): proto contract`.

---

## Step 6 - Move backend to port 8090
1. Change constant/ENV `BACKEND_PORT` in `backend/main.go` (and Dockerfile / compose).
2. Adjust CI/CD manifests (Helm chart, compose, k8s YAML) but **keep consumers on 8080** via temporary rewrite.
3. Provide Nginx proxy in `docker-compose.override.yml` mapping 8080→8090 so e2e stays happy.
4. Run `docker-compose up -d backend` locally & `yarn test:e2e` – ✅
5. Commit: `chore(backend): listen on 8090 (compat shim)`.

---

## Step 7 - Create API Gateway skeleton (still unused)
1. New Go module `gateway` listening on 8080.
2. Define identical routes but handlers simply `httputil.NewSingleHostReverseProxy` to `http://backend:8090`.
3. Add lightweight logging & health endpoint `/healthz`.
4. Add gateway service to docker compose; **do not route tests through it yet**.
5. Ensure all tests still pass via legacy path (rewrite remains).
6. Commit: `feat(gateway): proxy layer ready`.

---

## Step 8 - Switch consumers to gateway
1. Remove Nginx rewrite.
2. Update environment variables in:
   * Frontend `.env` → `VITE_API_BASE_URL=http://localhost:8080`
   * Agent `config.ts`
   * MCP server `config.go`
3. Regenerate any API fixtures.
4. `yarn test:e2e` – fix regressions if any until green.
5. Commit: `feat: route all traffic through gateway`.

---

## Step 9 - Harden gateway
1. Add structured logging middleware.
2. Implement request ID propagation and timeout budget (e.g. `context.WithTimeout`).
3. Add circuit-breaker (`github.com/sony/gobreaker`) & basic retry.
4. Write unit tests for proxy logic.
5. e2e must remain green.
6. Commit: `feat(gateway): hardening`.

---

## Step 10 - Cleanup & documentation
1. Delete dead code (old structs, rewrite configs).
2. `go mod tidy` & `yarn clean`.
3. Update README architecture diagram.
4. Final `yarn test:e2e`.
5. Commit: `chore: api-gateway rollout complete`.

---

# Done 🎉
Front-end, agent, backend, and MCP now share a single protobuf contract and communicate exclusively through the new API Gateway on port 8080.
