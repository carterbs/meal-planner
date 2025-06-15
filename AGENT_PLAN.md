Overview

Create Go backend routes that interface with the Node.js CLI agent to enable web-based agent interactions. The backend will serve as a thin proxy between the frontend and the CLI agent, leveraging the agent's existing workflow state persistence and providing real-time communication.

Phase 1: Core Agent Handler Infrastructure

1.1 Create Agent Handler Module

File: backend/handlers/agent.go
- Implement agent process management using os/exec
- Handle CLI invocation with proper argument passing
- Implement response parsing and error handling
- Add timeout and cancellation support
- Ensure agent process doesn't kill backend parent process

1.2 Agent Response Types

File: backend/models/agent.go
- Define structs for agent communication:
  - AgentStartRequest
  - AgentFeedbackRequest
  - AgentResumeRequest
  - AgentResponse
  - WorkflowStatus
- Add JSON serialization tags
- Include validation methods

1.3 Agent Integration

- Leverage existing agent persistence (PostgresCheckpointSaver)
- No additional database models needed - agent handles its own state
- Backend acts as thin proxy to agent's existing workflow management
- Add thread ID to meal plan relationship for linking web UI to agent workflows

Phase 2: API Endpoints

2.1 Start Workflow Endpoint

Route: POST /api/agent/start
// Request body: { "participants": ["brad", "shannon"], "workflow_type": "meal_planning" }
// Response: { "thread_id": "uuid", "status": "started", "message": "..." }

2.2 Add Feedback Endpoint

Route: POST /api/agent/feedback
// Request body: { "thread_id": "uuid", "message": "feedback text", "from": "brad" }
// Response: { "success": true, "status": "feedback_added", "message": "..." }

2.3 Resume Workflow Endpoint

Route: POST /api/agent/resume
// Request body: { "thread_id": "uuid", "interactive": false }
// Response: { "success": true, "current_step": "...", "message": "...", "meal_plan": {...} }

2.4 Get Checkpoint Data Endpoint

Route: GET /api/agent/checkpoint/:thread_id
// Response: { 
//   "success": true, 
//   "status": "retrieved", 
//   "meal_plan": {
//     "days": [
//       { "meal": { "name": "Meal Name", "effort": 1, "hasRedMeat": false } },
//       ...
//     ]
//   },
//   "current_step": "step_name",
//   "last_updated": "2025-06-15T18:44:19.643Z"
// }

2.5 Workflow Status Endpoint

Route: GET /api/agent/status/{thread_id}
// Response: { "thread_id": "uuid", "workflow_type": "meal_planning", "current_step": "...", "participants": [...] }

2.5 List Workflows Endpoint

Route: GET /api/agent/workflows
// Query params: ?type=meal_planning&limit=10
// Response: [{ "thread_id": "uuid", "workflow_type": "...", "status": "...", "created_at": "..." }]

2.6 Cancel Workflow Endpoint

Route: DELETE /api/agent/workflows/{thread_id}
// Response: { "success": true, "message": "Workflow cancelled" }

Phase 3: Integration & Error Handling

3.1 CLI Integration
- Implement process spawning with proper environment setup
- Handle CLI build verification (check for agent/dist/cli.js)
- Add database connection validation before CLI invocation
- Implement proper signal handling for process cleanup
- The agent should not kill the backend when it is started. It currently does, assumning that it is the entry point. Sometimes it will be. But in this case, the backend is the entrypoint. Make sure this doesn't happen.

3.2 Error Handling & Logging
- Add structured logging for all agent operations
- Implement proper error responses with HTTP status codes
- Add timeout handling for long-running operations
- Include CLI stderr capture and parsing

3.3 Process Management
- Handle concurrent agent process spawning
- Implement proper process cleanup and resource management
- Add process timeout handling for long-running operations
- Monitor agent process health and restart if needed

Implementation Details

File Structure

backend/
├── handlers/
│   ├── agent.go          # Main agent handler (process proxy)
│   └── agent_test.go     # Handler tests
│   ├── workflow.go       # Workflow handler (read only access to workflow status)
│   └── workflow_test.go  # Handler tests
│   ├── checkpoint.go     # Checkpoint handler (read only access to checkpoint state)
│   └── checkpoint_test.go  # Handler tests
├── models/
│   ├── agent.go          # Agent request/response types
│   └── agent_test.go     # Model tests
│   ├── workflow.go       # Workflow types
│   └── workflow_test.go  # Model tests
│   ├── checkpoint.go     # Checkpoint types
│   └── checkpoint_test.go  # Model tests
└── main.go              # Route registration

Route Registration (main.go)

// Agent management routes
r.Route("/api/agent", func(r chi.Router) {
    r.Post("/start", handlers.StartAgentWorkflow)
    r.Post("/feedback", handlers.AddAgentFeedback)
    r.Post("/resume", handlers.ResumeAgentWorkflow)
    r.Get("/status/{threadId}", handlers.GetWorkflowStatus)
    r.Get("/workflows", handlers.ListWorkflows)
    r.Delete("/workflows/{threadId}", handlers.CancelWorkflow)
})

Dependencies
- No new Go dependencies required (using stdlib os/exec)
- Leverage existing chi router and database patterns
- Reuse existing error handling middleware

Testing Strategy
- Unit tests for all handler functions
- Integration tests with mock CLI responses
- Error scenario coverage (CLI failures, timeouts, etc.)
- Database integration tests

Security Considerations
- Input validation for all requests
- Thread ID format validation
- Rate limiting for agent operations
- Proper process cleanup and resource management

