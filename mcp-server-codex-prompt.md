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

To avoid implementing the protocol from scratch, we will use off-the-shelf MCP server libraries. By using this SDK, we avoid writing low-level protocol code. Security and session management features are built-in following best practices. For instance, the SDKs will handle the JSON schema of messages and allow us to focus on hooking up our specific logic (the meal planner's API calls) to MCP resources/tools definitions.

## MCP Server Specification for the Meal Planner
### 1 Scope & Goals
Only Resources (read) and Tools (write/act) are required; Prompts, auth, or scaling are out of scope.

### 2 Prerequisites

Everything else is vendored in repo. No external downloads needed once the repo is cloned.

### 3 Directory Layout  (relative to repo root)
```
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
```

### 4 Runtime Contracts

ENV var	Default	Purpose
BACKEND_BASE_URL	http://localhost:8080	Go API root

No other configuration exists.
If the Go API port changes, only update BACKEND_BASE_URL.

### 5 MCP Surface — Canonical Specification

All JSON keys are exact; do not rename. All responses are JSON unless noted otherwise.

#### 5.1 Resources (read‑only)
Tab separated table:
```
Name	REST call	Response schema
WeeklyMealPlan	GET /api/mealplan	```ts type WeeklyMealPlan = { days: { date: string; mealId: number; mealName: string; effort: 'LOW'
Recipes	GET /api/meals	```ts type RecipeSummary = { id: number; name: string; redMeat: boolean; effort: 'LOW'
RecipeSteps	GET /api/meals/{id}/steps	ts type Step = { order: number; text: string }; type RecipeSteps = Step[]; 
```

#### 5.2 Tools (write / derive)
Tab separated table:
```
Name	REST sequence (exact order)	Input params	Returns
generateMealPlan	POST /api/mealplan/generate	none	WeeklyMealPlan
finalizeMealPlan	POST /api/mealplan/finalize	none	{ ok: true }
swapMeal	POST /api/mealplan/swap	{ dayIndex: 0‑6 }	WeeklyMealPlan
replaceMeal	POST /api/mealplan/replace	{ dayIndex: 0‑6; newMealId: number }	WeeklyMealPlan
generateShoppingList	POST /api/shoppinglist	none	ts type Item = { name: string; quantity: string }; type ShoppingList = Item[]; 
createRecipe	1. POST /api/meals 2. POST /api/meals/{id}/steps/bulk 3. (optional) ingredient adds¹	```ts type NewRecipe = { name: string; redMeat: boolean; effort: 'LOW' 'MED'
deleteRecipe	DELETE /api/meals/{id}	{ id: number }	{ ok: true }
```
¹ Ingredient endpoint in Go API is POST /api/meals/{id}/ingredients (already exists).

## 6 Error Handling
	•	Any non‑2xx from backend → MCP error code‑32000 "BackendError" with original message.
	•	Validation errors (e.g., missing dayIndex) → ‑32602 "Invalid params".
	•	Unexpected exceptions → ‑32603 "Internal error".

All errors are logged to stderr with timestamp and full stack.

## 7 Implementation Checklist (in order)
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

### 8 Sample JSON‑RPC Call

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
- ✅ **Dependencies Installed**: Official MCP SDK, TypeScript tooling, Jest
- ✅ **TypeScript Setup**: Configured with ES2022 target and proper module resolution
- ✅ **Stdio Transport**: MCP server connects via standard input/output (no HTTP server)
- ✅ **Hello World Tool**: Basic "hello" tool for testing MCP functionality
- ✅ **Test Suite**: Jest-based tests for MCP tool logic

**Current Status**: The MCP server runs over stdio. The hello world tool is functional and tested. Ready for meal planner integration.

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

## SDK Cheat Sheet
Below is a **self-contained cheat-sheet** for the **Model Context Protocol TypeScript SDK**.  
It pulls together the signatures, default options, and enums you’re most likely to hunt for while wiring your meal-planner server—all in one page so an offline LLM never has to “go look it up”.

---

## 1  Installation

```bash
npm install @modelcontextprotocol/sdk zod          # runtime deps
npm install -D typescript @types/node              # if you’re compiling TS
``` 

---

## 2  Top-Level Imports & Core Classes

| What you import | Why you need it |
|-----------------|-----------------|
| `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` | High-level server with built-in registries for resources, tools, prompts. |
| `Server` from `@modelcontextprotocol/sdk/server/index.js` | Lower-level class if you need custom request handlers. |
| `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js` | Runs over stdin/stdout—perfect for local dev & CLI integrations. |
| `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js` | Exposes a single `/mcp` endpoint (POST) plus SSE for streaming. | 

---

## 3  Bootstrapping a Server

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name:    "mealplanner-mcp",
  version: "1.0.0",
});

await server.connect(new StdioServerTransport());
```

`new McpServer(info, options?)`  
* **info** ➜ `{ name: string; version: string }`  
* **options** ➜ `{ logger?, capabilities?, session?, … }` (all optional—rarely needed for simple projects) 

---

## 4  Registering Resources

```ts
type WeeklyMealPlan = {
  days: {
    date: string;
    mealId: number;
    mealName: string;
    effort: "LOW"|"MED"|"HIGH";
  }[];
};

server.resource<WeeklyMealPlan>(
  "WeeklyMealPlan",
  async () => {
    const res = await fetch(`${process.env.BACKEND_BASE_URL}/api/mealplan`);
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    return res.json();
  }
);
```

**Signature**

```ts
server.resource<T>(
  name: string,
  loader: () => Promise<T>,
  opts?: { mimeType?: string; description?: string }
);
```

Adds a fixed, read-only URI under `res://{name}` which MCP clients can list & fetch.

---

## 5  Registering Tools

```ts
import { z } from "zod";

const swapArgs = z.object({
  dayIndex: z.number().int().min(0).max(6),
});

server.tool(
  "swapMeal",
  swapArgs,
  async ({ dayIndex }) => {
    const resp = await fetch(`${process.env.BACKEND_BASE_URL}/api/mealplan/swap`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ dayIndex }),
    });

    if (!resp.ok) {
      return {                        // tool-level error the model can see
        isError: true,
        content: [{ type:"text", text:`Backend ${resp.status}` }]
      };
    }

    return {
      content: [{ type:"json", json: await resp.json() }],
      annotations: { idempotentHint: false }
    };
  },
  {
    annotations: { destructiveHint: false, readOnlyHint: false }
  }
);
```

**Signature**

```ts
server.tool<Input, Output = any>(
  name: string,
  inputSchema: z.Schema<Input> | null,            // null for no params
  handler:  (args: Input, extra) => Promise<ToolResult<Output>>,
  opts?:    { annotations?: ToolAnnotations; outputSchema?: z.Schema<Output> }
);
```

`ToolResult` is:

```ts
{
  content?: [{
    type:"text"|"json"|"image"|"audio",
    text?|json?|data?,
    mimeType?
  }],
  structuredContent?: Output,   // validated against outputSchema if provided
  isError?: boolean
}
```

---

## 6  Tool Annotations Cheat-Sheet

| Key | Default | What clients assume |
|-----|---------|--------------------|
| `title` | *undefined* | Friendly UI label. |
| `readOnlyHint` | `false` | `true` → no state change. |
| `destructiveHint` | `true` (when `readOnlyHint` false) | Warn before irreversible ops. |
| `idempotentHint` | `false` | Safe to retry if `true`. |
| `openWorldHint` | `true` | Touches the internet / external systems. | 

---

## 7  Standard Transports

| Transport | When to use | Listen call |
|-----------|-------------|-------------|
| **Stdio** | CLI, local desktop apps (Claude Desktop, Cursor, etc.). | `await server.connect(new StdioServerTransport())` |
| **Streamable HTTP** | Multiple clients or remote deployment (K8s, Fly.io, etc.). | `await server.connect(new StreamableHTTPServerTransport({ port: 3001 }))` | 

Both transports speak **JSON-RPC 2.0**; Streamable HTTP multiplexes requests over `POST /mcp` and streams responses/notifications back via **SSE**.

---

## 8  Error Codes You Should Return

| Code | Name | When to use |
|------|------|-------------|
| `-32700` | Parse error | Malformed JSON. |
| `-32600` | Invalid request | Not a valid JSON-RPC object. |
| `-32601` | Method not found | Unsupported MCP method. |
| `-32602` | Invalid params | Input validation failed (e.g., Zod error). |
| `-32603` | Internal error | Uncaught exception in your code. |
| `-32000 … -32099` | Server error | Custom domain errors, e.g., `-32000 BackendError`. | 

**Tip** – the SDK exposes `new McpError(code, message, data?)` for convenience.

---

## 9  Minimal End-to-End Example

```ts
// index.ts
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "hello-world", version: "1.0.0" });

server.tool(
  "add",
  z.object({ a: z.number(), b: z.number() }),
  ({ a, b }) => ({
    content: [{ type:"text", text: String(a + b) }],
    annotations: { idempotentHint: true, readOnlyHint: true }
  })
);

await server.connect(new StdioServerTransport());
```

Compile → `tsc && node build/index.js`, then call:

```bash
printf 'Content-Length: 49\n\n{"jsonrpc":"2.0","id":1,"method":"add","params":{"a":2,"b":3}}' | node build/index.js
```

…and you’ll receive the JSON-RPC response with `"result":{…,"text":"5"}`.


## Tool Definition Best Practices
A well-written MCP tool definition is essentially a micro-contract between three parties: your code, the MCP client UI, and the LLM reading the JSON it produces.  Good tools make that contract explicit, enforceable, and safe.  The six examples above show how to do that by combining clear intent, strict validation, rich metadata, and defensive error handling—all practices recommended in the MCP spec and common API-design literature.  Below is a deeper look at why those snippets are strong and a concise checklist you can reuse when authoring meal-planner tools.

### Core Principles of a Good MCP Tool Definition

1. Clear, Human-Readable Purpose
	• Single responsibility & descriptive name – add, calculateBMI, sendEmail, etc. tell both the LLM and the approving human exactly what happens.  The MCP docs emphasize that concise names aid agent planning and user consent flows.  ￼
	• Helpful descriptions on every parameter (describe("First addend")) improve autocompletion and UI labeling.  ￼

2. Explicit, Enforced Schemas
Using Zod guarantees inputs are well-formed before any side-effects occur, preventing prompt-injection attempts or type mismatches. Zod also infers TypeScript types, giving compile-time safety in your handler.  ￼

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


## Next Steps: Meal Planner Integration

Summary
In summary, the plan is to build a lightweight MCP server on top of the existing meal-planner REST API. We will use actively maintained tools (e.g., the official TS MCP SDK) to avoid low-level work. The server will expose key functionalities – meal plan retrieval/generation, shopping list creation, recipe listing/creation, and more – as MCP endpoints that an AI can call. Running the server on a local Mac or Linux PC is straightforward: keep the original app running (e.g., via Docker/Postgres), launch the MCP server script in stdio mode, and connect an AI client for testing. With minimal users, we don't need elaborate scaling or deployment; focus is on correctness and convenience. This approach leverages the strength of MCP (standardized AI-tool interface) to make our meal planner "AI-ready" without rewriting its core – an efficient and maintainable solution for adding intelligent assistance to the application.
