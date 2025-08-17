# MCP Primer
## Big-picture takeaway

MCP is a JSON-RPC 2.0–based protocol that lets LLM clients discover prompts (user-controlled templates), resources (app-controlled context blobs), and tools (model-controlled functions) from servers.  A three-phase lifecycle (initialize → operate → shutdown) negotiates protocol version and capabilities; once established, structured messages let clients list, read, call, and subscribe to those primitives.  Revision 2025-06-18 is now the current spec, adds first-class structured tool output, removes JSON-RPC batching, and aligns servers with OAuth Resource-Server conventions for tighter auth.  ￼ ￼ ￼


1. Layered architecture

Base protocol
	•	All traffic is JSON-RPC 2.0, enriched with _meta for extensibility.  ￼
	•	Message types: requests, responses, notifications; IDs must be unique and non-null.  ￼

Connection lifecycle
	1.	Initialization – client sends initialize with supported version & capabilities; server echoes or downgrades.
	2.	Operation – regular RPC calls respecting negotiated capabilities.
	3.	Shutdown – clean transport close (stdio stream close or HTTP connection drop).  ￼

2. Server primitives

Primitive	Control	Key RPCs	Typical use	Capabilities flags	Notifications
Prompts	User	prompts/list, prompts/get	Slash commands, templates	prompts.listChanged	notifications/prompts/list_changed  ￼
Resources	App	resources/list, resources/read, resources/subscribe	Files, DB schemas, docs	resources.subscribe, resources.listChanged	notifications/resources/updated  ￼
Tools	Model	tools/list, tools/call	API calls, file ops	tools.listChanged	notifications/tools/list_changed  ￼

All three return Content Blocks that may be text, image, audio, resource links, or embedded resources, each carrying optional annotations (audience, priority, lastModified).  ￼ ￼

3. Capabilities & negotiation tips
	•	Servers declare a capabilities object during initialize; absent sub-keys mean the feature is unsupported.
	•	Clients should only invoke RPCs that correspond to mutually agreed capabilities.  ￼

# `mcp-service` – Model Context Provider Service

## Development commands
* `yarn install` – Install dependencies.
* `yarn dev` – Start the service in watch mode.
* `yarn build` – Compile the TypeScript sources.
* `yarn test` – Run unit tests with Jest.
* `yarn lint` – Lint and format code with ESLint
  and Prettier.

You can also run `docker-compose up mcp-service` to start it alongside
its dependencies.

## Implementation guidelines
1. **Strict typing.**  Do not use `any`.
2. **Validation.**  Validate incoming requests using Zod or a similar
   library at the handler level.  Reject invalid requests with
   descriptive errors.
3. **Testing philosophy.** Tests should exercise actual logic.  When 
   mocking external services, provide realistic stub responses and avoid
   asserting on the mocks themselves.
4. **Plan mode.**  Before implementing a new feature, outline the
   expected flow and interactions with other services.

## Adding a new endpoint
// todo