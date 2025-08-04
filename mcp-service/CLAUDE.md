## MCP Primer
Below is a “need-to-know” overview of the Model Context Protocol (MCP) – Server-side, rev 2025-06-18.
### Big-picture takeaway

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

⸻

4. Versioning & compatibility
	•	Specs are marked Draft → Current → Final; 2025-06-18 is Current.  ￼
	•	Clients include an MCP-Protocol-Version header (for HTTP) after initialization.  ￼
	•	If version mismatch occurs, servers reply with supported versions; clients may reconnect or abort.  ￼
