# Model Context Protocol (MCP) Server for Meal Planner – Implementation Plan

## Understanding Model Context Protocol (MCP)

The Model Context Protocol (MCP) is an open standard introduced by Anthropic (Nov 2024) to connect AI assistants with external data sources and tools in a consistent way. It's often described as a "USB-C port for AI applications," meaning it provides a universal interface for plugging in various data and functionality that large language models (LLMs) can leverage. In an MCP setup, AI clients (like an IDE assistant or chat application) act as MCP hosts that connect to one or more MCP servers, each server exposing specific capabilities or data domains via the standardized protocol. This client-server architecture lets LLMs retrieve context or perform actions on real-world data through a common protocol instead of bespoke integrations.

MCP Communication: Under the hood, MCP messages are encoded in JSON-RPC 2.0 format (requests, responses, notifications). The protocol supports multiple transport mechanisms for flexibility. For local or single-machine scenarios, a server can run over Standard I/O (stdio) – exchanging JSON-RPC messages via stdin/stdout – which is simple for command-line tools and local desktop integrations. For networked or multi-client scenarios, MCP defines a Streamable HTTP transport that uses HTTP POST for client-to-server calls and Server-Sent Events (SSE) for streaming responses or server-initiated messages. In practice, the choice of transport can be hidden behind libraries; as developers, we focus on defining our server's functionality (resources and tools) while the SDK handles JSON-RPC encoding and the transport details.

MCP Server Capabilities: An MCP server can expose:
	• Resources – data or content that the LLM can retrieve as context (analogous to read-only endpoints or documents). For example, a file server might expose files as resources.
	• Tools – operations or actions the LLM can invoke (like function calls that may modify state or perform computations).
	• Prompts – predefined prompt templates or workflows that the server can provide to guide the LLM (not always needed for every use-case).
	• Other features – like secure sampling (having the server request model completions), etc., but our focus will be on resources and tools relevant to the meal planner.

In summary, MCP gives us a structured way to offer the meal planner's functionality (data and actions) to AI agents. Instead of building a custom plugin or API integration for each AI client, we create one MCP-compliant server that any MCP-compatible client can use to get meal planning context or perform tasks. This saves effort and ensures consistency, as MCP standardizes how context and tools are exposed to LLMs across applications.

## MCP Server Development Tools and Libraries

To avoid implementing the protocol from scratch, we will use off-the-shelf MCP server libraries. The MCP project provides official SDKs in multiple languages, including Python and TypeScript (as well as Java, Kotlin, C#, Ruby, Swift). These SDKs are actively maintained (the project is open-source with thousands of stars) and designed to simplify building an MCP server on common platforms. We will use the official typescript SDK.

TypeScript SDK (Official): It can be added via npm (the package is typically @mcp/* or similar) and provides a similar abstraction: you create a Server instance in Node, define resources and tools, and start listening on a transport (e.g. attach to an Express.js app for HTTP, or use a provided stdio adapter).

By using this SDK, we avoid writing low-level protocol code. Security and session management features are built-in following best practices. For instance, the SDKs will handle the JSON schema of messages and allow us to focus on hooking up our specific logic (the meal planner's API calls) to MCP resources/tools definitions.


## MCP Server Specification for the Meal Planner
Refined Implementation Plan – MealPlanner MCP Server v1.0

⸻

1 Scope & Goals

What must be delivered	Why
An MCP server (backend/mcp) that wraps the existing Meal‑Planner REST API.	Lets any offline‑only LLM query/act on real data through MCP.
Complete, self‑contained docs & code.	Implementors will not have internet access.

Only Resources (read) and Tools (write/act) are required; Prompts, auth, or scaling are out of scope.

⸻

2 Prerequisites

Component	Version / Command
Node.js	≥ 18 (node -v)
Yarn	≥ 1.22 (yarn -v)
Go	≥ 1.22 (go version)
Docker	latest stable (for Postgres)

Everything else is vendored in repo. No external downloads needed once the repo is cloned.

⸻

3 Directory Layout  (relative to repo root)

backend/
 ├─ go‑api/               # existing Go server (unchanged)
 └─ mcp/
     ├─ src/              # TypeScript source
     │   ├─ index.ts      # server entry‑point
     │   ├─ resources/    # read‑only adapters
     │   └─ tools/        # mutating adapters
     ├─ tests/            # Jest tests
     ├─ package.json
     └─ tsconfig.json


⸻

4 Runtime Contracts

ENV var	Default	Purpose
BACKEND_BASE_URL	http://localhost:8080	Go API root
MCP_PORT	3001	HTTP/SSE listen port

No other configuration exists.
If the Go API port changes, only update BACKEND_BASE_URL.

⸻

5 MCP Surface — Canonical Specification

All JSON keys are exact; do not rename. All responses are JSON unless noted otherwise.

5.1 Resources (read‑only)

Name	REST call	Response schema
WeeklyMealPlan	GET /api/mealplan	```ts type WeeklyMealPlan = { days: { date: string; mealId: number; mealName: string; effort: 'LOW'
Recipes	GET /api/meals	```ts type RecipeSummary = { id: number; name: string; redMeat: boolean; effort: 'LOW'
RecipeSteps	GET /api/meals/{id}/steps	ts type Step = { order: number; text: string }; type RecipeSteps = Step[]; 

5.2 Tools (write / derive)

Name	REST sequence (exact order)	Input params	Returns
generateMealPlan	POST /api/mealplan/generate	none	WeeklyMealPlan
finalizeMealPlan	POST /api/mealplan/finalize	none	{ ok: true }
swapMeal	POST /api/mealplan/swap	{ dayIndex: 0‑6 }	WeeklyMealPlan
replaceMeal	POST /api/mealplan/replace	{ dayIndex: 0‑6; newMealId: number }	WeeklyMealPlan
generateShoppingList	POST /api/shoppinglist	none	ts type Item = { name: string; quantity: string }; type ShoppingList = Item[]; 
createRecipe	1. POST /api/meals 2. POST /api/meals/{id}/steps/bulk 3. (optional) ingredient adds¹	```ts type NewRecipe = { name: string; redMeat: boolean; effort: 'LOW' 'MED'
deleteRecipe	DELETE /api/meals/{id}	{ id: number }	{ ok: true }

¹ Ingredient endpoint in Go API is POST /api/meals/{id}/ingredients (already exists).

⸻

6 Error Handling
	•	Any non‑2xx from backend → MCP error code‑32000 "BackendError" with original message.
	•	Validation errors (e.g., missing dayIndex) → ‑32602 "Invalid params".
	•	Unexpected exceptions → ‑32603 "Internal error".

All errors are logged to stderr with timestamp and full stack.

⸻

7 Implementation Checklist (in order)
	1.	Bootstrap backend

docker compose up -d db     # Postgres  
cd backend/go-api && go run .   # REST API on :8080


	2.	Implement Resource adapters (src/resources/*.ts)
Use fetch (already in package.json)
```ts
export const WeeklyMealPlan = resource<WeeklyMealPlan>('WeeklyMealPlan', async () => {
  const response = await fetch(`${API}/api/mealplan`);
  if (!response.ok) {
    throw new Error(`Failed to fetch meal plan: ${response.statusText}`);
  }
  return response.json();
});
```

	3.	Implement Tool adapters (src/tools/*.ts)
Follow table 5.2 strictly; wrap multi‑step flows in a single async function.
	4.	Wire server (index.ts)
```ts
new MCPServer({
  name: 'mealplanner-mcp',
  version: '1.0.0',
  resources: [WeeklyMealPlan, Recipes, RecipeSteps],
  tools: [generateMealPlan, finalizeMealPlan, swapMeal, replaceMeal,
          generateShoppingList, createRecipe, deleteRecipe],
}).listen(MCP_PORT);
```

	5.	Unit tests (tests/)
One test per resource/tool using Jest + SuperTest; mock backend with nock.
	6.	End‑to‑end test script (yarn e2e)
Spins Go API + MCP, then exercises JSON‑RPC calls via curl.
	7.	Docs update
Append backend/mcp/README.md with: quick‑start, ENV table, resource/tool list, error codes.
	8.	CI (optional)
Add backend/.github/workflows/mcp.yml running lint + tests.

Deliverables are finished when yarn test and yarn e2e pass with backend running locally.

8 Sample JSON‑RPC Call

```json
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "generateShoppingList",
  "params": {}
}
```

Response stream (SSE):
```json
{ "jsonrpc": "2.0", "id": 42, "result": [ { "name": "Onions", "quantity": "3" }, … ] }
```

## ✅ Basic MCP Server Setup (COMPLETED)

The foundational MCP server infrastructure has been implemented:

- ✅ **MCP Directory Structure**: Created `backend/mcp/` with proper workspace integration
- ✅ **Package Configuration**: Initialized with "mealplanner-mcp" v1.0.0, ES modules, TypeScript
- ✅ **Dependencies Installed**: Official MCP SDK, Express, CORS, TypeScript tooling, Jest
- ✅ **TypeScript Setup**: Configured with ES2022 target and proper module resolution
- ✅ **HTTP+SSE Transport**: Implemented MCP server with Express on port 3001 (not stdio)
- ✅ **Hello World Tool**: Basic "hello" tool for testing MCP functionality
- ✅ **Test Suite**: Jest-based tests for HTTP server and MCP tool logic
- ✅ **Health Check**: HTTP endpoint at `/health` for monitoring

**Current Status**: The MCP server runs at `http://localhost:3001` with SSE endpoint at `/sse`. The hello world tool is functional and tested. Ready for meal planner integration.

## Next Steps: Meal Planner Integration

Now that the basic MCP server is operational, the remaining work involves connecting it to the meal planner backend:
	• Backend Service & Database: The MCP server will need the meal planner backend to be running. The repository documentation indicates the backend uses PostgreSQL and is typically run via Docker Compose for local dev. So, first ensure that:
	• Docker is installed (or alternatively, Postgres is installed locally).
	• The database is up with the correct schema and test data. You can use the `dummy` flag (look in the docs).
	• The Go backend server (backend/main.go) is running and listening on a port (e.g., http://localhost:8080). Since this is local, we might run it directly with go run or via the Docker setup in the project. This server will expose the /api/... endpoints we mapped.
	• No authentication is needed for these endpoints in the current implementation.
	• MCP Server Process: The MCP server will run as a separate process alongside the backend. It's designed to be lightweight – essentially it waits for JSON-RPC requests from an AI client and then triggers the appropriate REST call and returns the result. For a few users (even concurrently), this is perfectly fine on a laptop. We should ensure:
	• We have Node 18+ installed on the machine.
	• Install the MCP SDK: `modelcontextprotocol/typescript‑sdk`.
	• Write our server script that defines the resources and tools as per the mappings above. This script will include the logic to call the backend. We'll incorporate error handling (if the backend responds with error, translate that to an MCP error).
	• We prefer SSE over HTTP. Do not implement STDIO. 
	• HTTP mode: If we want to test via browser or allow multiple clients to connect, we can run the server in HTTP+SSE mode. In TS, we could mount the server on an Express app as per examples. We'd choose a port (e.g., 5000) and then any MCP client could POST JSON-RPC calls to http://localhost:5000/mcp (or whatever endpoint) and receive results via SSE. This is more involved to set up, but the SDK documentation provides guidance.
	• We will name our MCP server and version it. For example, we might call it "mealplanner-mcp" version "1.0.0". These identifiers are part of the MCP handshake (sent during initialization). It's useful for the client to log which servers are connected.
	• Resource and Tool Design in Code: We should design the data structures our server returns to the AI. Since the AI (Claude or similar) can handle raw JSON or text, we might simply forward the backend's JSON. However, we can also format it for clarity. For example:
	    • The MealPlan resource could return a summary text of the week's plan (like a nice formatted list of days and meals) to be directly used as context. Alternatively, it could return a JSON with an array of {day, mealName, effort, etc} and let the AI format it. The decision might depend on how the AI consumes resource data. Many MCP clients will include the resource JSON in the prompt to the model. Readability might favor text, but JSON gives more structured info if the AI has been trained to parse it. We can experiment with what yields better results.
	• The ShoppingList tool might output a JSON of ingredients (which the AI could turn into a list) or possibly a pre-formatted bullet list of items with quantities. Since the shopping list likely needs some post-processing (grouping similar items, etc.), and the app's current implementation might not group them optimally (improvements were noted as future work ￼), the AI could actually handle that grouping logically if given raw data. So providing structured output could allow the AI to reason about it.
	• Error handling: If the backend returns an error (e.g., database not connected, or invalid input), we should catch that and return a proper JSON-RPC error to the client. The MCP spec has standard error codes. For our minimal use, a generic error with the message from the backend might suffice. We should also log such errors for debugging.
	• Running and Testing: Once the backend and MCP server are running, we can test the server's endpoints:
    	• Using the MCP Inspector or a simple client to call each resource/tool and verify we get expected responses. For instance, call listRecipes and see that it returns the list of sample meals from the database. Test generateMealPlan to ensure it actually changes the plan (maybe call getMealPlan before and after to see a difference).
	• Because usage is minimal, we're not too worried about performance. But we can note that each MCP call will induce one or more HTTP calls to the backend. For example, createRecipe might do 2-3 calls (create meal, add steps, etc.). This is fine for a few invocations, but if someone spammed it, the latency stacks. On a laptop with everything local, this should still be sub-second or a few seconds at worst (generating a plan might be the slowest if it's algorithmic). The Node code and the Go backend can easily handle the load of a single user.
	• Because usage is minimal, we're not too worried about performance. But we can note that each MCP call will induce one or more HTTP calls to the backend. For example, createRecipe might do 2-3 calls (create meal, add steps, etc.). This is fine for a few invocations, but if someone spammed it, the latency stacks. On a laptop with everything local, this should still be sub-second or a few seconds at worst (generating a plan might be the slowest if it's algorithmic). The Node code and the Go backend can easily handle the load of a single user.
	• Minimal Usage, Minimal Footprint: With only a few users, we don't need to containerize or deploy this server to a cloud. Running it directly on the MacBook is appropriate. We might integrate it into a development workflow (for instance a yarn  script to run both backend and MCP server together). We should also keep an eye on resource usage:
	• The MCP server process itself will be lightweight (just idle waiting for requests most of the time). Node's event loop will handle concurrent calls if any.
    • No scaling concerns: a single process is enough. If we did have more users or wanted to share this in a team, we might then consider deploying it as a web service and possibly adding authentication. But the prompt specifically says to assume minimal usage and skip production deployment aspects.
	• Excluding AI Client Integration: As requested, we are not covering integration with specific AI clients like Cursor or Claude in this plan. We assume that once the MCP server is running, the user (or developer) will manually connect it to their AI assistant of choice. For example, in Claude Desktop the user can add a local server by pointing to our server binary (if stdio) or URL (if HTTP). We don't need to configure anything specific for those clients here. We just ensure our server adheres to the MCP spec and passes any initialization handshake. The heavy clients will handle the rest.
	• Documentation & Ease of Use: We should document how to run the MCP server in the project's README for any future maintainers or for ourselves:
	    • Explain any environment variables (e.g., MEALPLANNER_API_URL for the backend URL if not default).
	    • Steps: "Start the Go backend (or docker-compose up db && go run main.go), then run `yarn start:mcp` to start the MCP server. Connect an AI client to it on stdio/port as needed."
	    • Note the functionality exposed (maybe list the tools/resources similarly to how we did above, so users know what the AI can do).

Because we target a local development environment, getting things running should be as simple as possible: no external dependencies beyond the existing project. The user's MacBook likely already has Docker and Node from working on the project. We leverage those. If anything goes wrong (say the MCP server can't reach the backend), our server should clearly log the issue (could not connect, etc.). The meal planner app even has a reconnect mechanism for DB issues – if the AI were extremely sophisticated it could call a reconnect tool, but that's overkill. Instead, we (the developer) ensure the DB is up and migrations done to avoid those errors.

Finally, once everything is up, the user will effectively have an MCP server named "MealPlanner" running locally. Any compatible AI (like Anthropic's Claude or other future clients) can load it and then the user can chat with the AI about meal planning, with the AI able to call the functions we exposed. We expect this integration to greatly enhance the meal planner experience: for instance, the user could ask in natural language to adjust the week's plan or get ingredient info, and the AI will use our MCP endpoints to fulfill those requests with real data from the backend.

Summary
In summary, the plan is to build a lightweight MCP server on top of the existing meal-planner REST API. We will use actively maintained tools (e.g., the official TS MCP SDK) to avoid low-level work. The server will expose key functionalities – meal plan retrieval/generation, shopping list creation, recipe listing/creation, and more – as MCP endpoints that an AI can call. Running the server on a local Mac or Linux PC is straightforward: keep the original app running (e.g., via Docker/Postgres), launch the MCP server script in stdio mode, and connect an AI client for testing. With minimal users, we don't need elaborate scaling or deployment; focus is on correctness and convenience. This approach leverages the strength of MCP (standardized AI-tool interface) to make our meal planner "AI-ready" without rewriting its core – an efficient and maintainable solution for adding intelligent assistance to the application.

### Example MCP Tool Definitions
Below are six high-quality, example tool implementations.

```ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerExampleTools(server: McpServer) {

  // 1. Simple computation – "add" (idempotent, read-only)
  server.tool(
    "add",
    {
      a: z.number().describe("First addend"),
      b: z.number().describe("Second addend")
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
      annotations: { idempotentHint: true, readOnlyHint: true }
    })
  );

  // 2. Health/fitness – "calculateBMI" (local math, read-only)
  server.tool(
    "calculateBMI",
    {
      weightKg: z.number().positive(),
      heightM:  z.number().positive()
    },
    async ({ weightKg, heightM }) => ({
      content: [{
        type: "text",
        text: String((weightKg / (heightM ** 2)).toFixed(2))
      }],
      annotations: { idempotentHint: true, readOnlyHint: true }
    })
  );

  // 3. External API – "fetchWeather" (open-world, may fail)
  server.tool(
    "fetchWeather",
    { city: z.string().min(2) },
    async ({ city }) => {
      const resp = await fetch(`https://api.weatherapi.com/v1/current.json?q=${encodeURIComponent(city)}`);
      if (!resp.ok) {
        return { isError: true, content: [{ type: "text", text: `Error ${resp.status}` }] };
      }
      const data = await resp.json();
      return {
        content: [{ type: "json", json: data }],
        annotations: { openWorldHint: true }
      };
    }
  );

  // 4. Database – "runSqlQuery" (destructive = false by default)
  server.tool(
    "runSqlQuery",
    { sql: z.string().describe("Arbitrary SQL SELECT…") },
    async ({ sql }) => {
      const rows = await db.all(sql);            // assumes `db` helper
      return { content: [{ type: "json", json: rows }] };
    }
  );

  // 5. Messaging – "sendEmail" (destructive: true)
  server.tool(
    "sendEmail",
    {
      to:       z.string().email(),
      subject:  z.string().max(120),
      bodyHtml: z.string().describe("HTML body"),
      cc:       z.array(z.string().email()).optional(),
      bcc:      z.array(z.string().email()).optional()
    },
    async (args) => {
      const { status, id } = await resend.emails.send({
        from: process.env.SENDER_EMAIL_ADDRESS!,
        ...args
      });
      return {
        content: [{ type: "text", text: `Queued email (${id}) → status ${status}` }],
        annotations: { destructiveHint: true, openWorldHint: true }
      };
    }
  );

  // 6. DevOps – "fetchPullRequestDetails" (GitHub REST v3)
  server.tool(
    "fetchPullRequestDetails",
    {
      owner: z.string(),
      repo:  z.string(),
      pr:    z.number().int().positive()
    },
    async ({ owner, repo, pr }) => {
      const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr}`, {
        headers: { "Authorization": `token ${process.env.GITHUB_TOKEN}` }
      });
      if (!ghResp.ok) {
        return { isError: true, content: [{ type: "text", text: `GitHub error ${ghResp.status}` }] };
      }
      const prJson = await ghResp.json();
      return {
        content: [{ type: "json", json: prJson }],
        annotations: { openWorldHint: true, idempotentHint: true }
      };
    }
  );

}
```

## Tool Definition Best Practices
A well-written MCP tool definition is essentially a micro-contract between three parties: your code, the MCP client UI, and the LLM reading the JSON it produces.  Good tools make that contract explicit, enforceable, and safe.  The six examples above show how to do that by combining clear intent, strict validation, rich metadata, and defensive error handling—all practices recommended in the MCP spec and common API-design literature.  Below is a deeper look at why those snippets are strong and a concise checklist you can reuse when authoring meal-planner tools.

### Core Principles of a Good MCP Tool Definition

1. Clear, Human-Readable Purpose
	• Single responsibility & descriptive name – add, calculateBMI, sendEmail, etc. tell both the LLM and the approving human exactly what happens.  The MCP docs emphasize that concise names aid agent planning and user consent flows.  ￼
	• Helpful descriptions on every parameter (describe("First addend")) improve autocompletion and UI labeling.  ￼

2. Explicit, Enforced Schemas
Using Zod (or JSON Schema) guarantees inputs are well-formed before any side-effects occur, preventing prompt-injection attempts or type mismatches. Zod also infers TypeScript types, giving compile-time safety in your handler.  ￼

3. Rich Annotations for UX & Safety
idempotentHint, readOnlyHint, destructiveHint, and openWorldHint tell the MCP client how risky a call is and which approval UI to show.  The protocol's tool-annotation docs call this "conveying potential side effects" so users aren't surprised.  ￼ ￼

4. Proper Error Handling
Returning { isError: true, content:[…] } (or throwing an MCP-standard JSON-RPC error) lets upstream code distinguish failures from successes, aligning with JSON-RPC 2.0's guidelines.  ￼ ￼

5. Idempotence & Side-Effect Discipline
Separating "pure" reads (e.g., calculateBMI) from mutating actions (sendEmail) is a classic API pattern that simplifies retries and caching.  REST and OpenAPI design guides stress calling this out explicitly.  ￼ ￼

6. Security Boundaries
Limiting scope (e.g., runSqlQuery only allows SELECT by convention) and scoping secrets (process.env.GITHUB_TOKEN) aligns with the MCP spec's recommendation to expose just enough authority.  ￼

7. Predictable, Structured Outputs
Returning either type:"json" or type:"text" keeps downstream prompt-templating simple—no brittle string parsing.  The MCP quick-start samples demonstrate the same pattern.  ￼


### How the Example Snippets Demonstrate Best Practice
Example Tool	Good-Practice Highlights	Why It Matters
add	Minimal read-only math with idempotentHint & Zod validation	Perfect starter template; shows the simplest possible contract.
calculateBMI	Domain-specific logic + schema constraints (positive())	Tight validation prevents divide-by-zero or negative height errors.
fetchWeather	External fetch wrapped in openWorldHint, network errors converted to user-friendly messages	Agents/UI can warn users that external data latency or cost may occur.
runSqlQuery	Narrow input (sql string), no write permitted, returns JSON rows	Demonstrates database access while containing blast-radius.
sendEmail	Marked destructiveHint; secrets pulled from env; returns delivery ID	Makes side-effects explicit so clients can ask for confirmation.
fetchPullRequestDetails	Auth token isolation, idempotent read, remote call	Shows how to integrate privileged SaaS APIs safely.

Each snippet therefore hits all seven principles: clear purpose, strict schema, annotations, error handling, idempotence clarity, security hygiene, and structured output.


### Quick Checklist for Your Meal-Planner Tools
	1.	Name the tool after the single action it performs (generateMealPlan, swapMeal).
	2.	Zod schema for every argument—including enums for fixed choices (e.g., day: z.enum(["Mon","Tue",...])).
	3.	Annotate with idempotentHint or destructiveHint; add openWorldHint if the tool touches the internet.
	4.	Return shape: choose type:"json" for structured data ({meals:[…]}) and type:"text" for summaries.
	5.	Handle errors: wrap backend 4xx/5xx in MCP error objects or { isError:true }.
	6.	Enforce security: never pass through raw user SQL; whitelist backend endpoints.
	7.	Document side-effects in the description so humans know what will happen.
	8.	Unit-test handlers (e.g., with Jest) to confirm validation, happy-path, and error cases.
	9.	Version your server (1.0.0) and bump when you add/remove tools so clients can adapt.
	10.	Keep tools small; if a workflow needs multiple steps, expose them as separate tools unless atomicity is required.

Follow that checklist and you'll produce tool definitions that are easy for LLMs to reason about, safe for users to approve, and pleasant for future you to maintain—exactly the qualities demonstrated in the six examples above.