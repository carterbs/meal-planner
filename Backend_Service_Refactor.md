Backend Service Refactor Plan

## Executive Summary
This refactor migrates the existing monolithic REST backend to a modular gRPC-based architecture fronted by a lightweight HTTP API Gateway. The objective is to improve performance, maintainability, and clarity without introducing feature flags, dual stacks, or advanced security tooling at this stage.

Key phases:
1. Convert the current Go backend to a gRPC service.
2. Introduce an API Gateway that converts HTTP/JSON requests to gRPC.
3. Extract the AI Agent into a separate gRPC service written in TypeScript.
4. Ship a Docker-Compose–driven local development stack.
5. Add health checks and structured logging for easy debugging.

## Guiding Principles
• Contract-first development with `.proto` files.
• Keep the stack simple—no backward-compatibility switches or mTLS for now.
• Observability starts with structured logs and request IDs; advanced tracing can come later.
• Single-developer ownership favors automation over hand-offs.

Desired Architecture

┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend  │───▶│   API Gateway   │───▶│  Agent Service  │───▶│ Backend Service │
└─────────────┘    │   (Go HTTP)     │    │  (TS + gRPC)    │    │  (Go + gRPC)    │
                   └─────────────────┘    └─────────────────┘    └─────────────────┘
                            ▲
                            │
                ┌─────────────────┐
                │   Agent CLI     │
                │   (HTTP Client) │
                └─────────────────┘

### Phase 1 – Convert Backend to gRPC Service

Goals  
- Expose all existing meal-planner functionality via a single `BackendService` declared in Protobuf.  
- Remove the REST router after migration—no feature flags or dual stacks.

Success Metrics  
- All current integration tests pass when executed via gRPC. Copy the e2e scripts in the scripts directory, and change them for gRPC.


1.1 Create Protobuf Definitions

File: proto/meal_planner.proto
syntax = "proto3";
package mealplanner;
option go_package = "mealplanner/proto";

// Core data types
message Meal {
int32 id = 1;
string meal_name = 2;
string meal_type = 3;
repeated Ingredient ingredients = 4;
repeated Step steps = 5;
}

message WeeklyMealPlan {
repeated DayMeals days = 1;
}

// Service definitions
service BackendService {
rpc GetAllMeals(GetAllMealsRequest) returns (GetAllMealsResponse);
rpc CreateMeal(CreateMealRequest) returns (CreateMealResponse);
rpc GenerateMealPlan(GenerateMealPlanRequest) returns (GenerateMealPlanResponse);
rpc GetMealPlan(GetMealPlanRequest) returns (GetMealPlanResponse);
rpc SwapMeal(SwapMealRequest) returns (SwapMealResponse);
// ... all current REST endpoints
}

1.2 Generate Go Code

# Install protoc and Go plugins
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Generate Go files
protoc --go_out=. --go-grpc_out=. proto/meal_planner.proto

1.3 Create gRPC Server

File: backend/grpc_server.go
type BackendServer struct {
    proto.UnimplementedBackendServiceServer
    services *services.ServiceContainer
}

func (s *BackendServer) GetAllMeals(ctx context.Context, req *proto.GetAllMealsRequest) (*proto.GetAllMealsResponse, error) {
    meals, err := s.services.MealService.GetAllMeals()
    if err != nil {
        return nil, status.Error(codes.Internal, err.Error())
    }
    
    protoMeals := convertMealsToProto(meals)
    return &proto.GetAllMealsResponse{Meals: protoMeals}, nil
}

1.4 Update Main to Run gRPC

File: backend/main.go
func main() {
    // ... existing setup ...
    
    // Start gRPC server
    lis, err := net.Listen("tcp", ":9090")
    if err != nil {
        log.Fatalf("Failed to listen: %v", err)
    }
    
    grpcServer := grpc.NewServer()
    proto.RegisterBackendServiceServer(grpcServer, &BackendServer{services: services})
    
    go func() {
        log.Printf("gRPC server listening on :9090")
        if err := grpcServer.Serve(lis); err != nil {
            log.Fatalf("Failed to serve gRPC: %v", err)
        }
    }()
    
    // Keep existing HTTP server for backward compatibility during migration
    log.Printf("HTTP server listening on :8080")
    if err := http.ListenAndServe(":8080", r); err != nil {
        log.Fatalf("Failed to serve HTTP: %v", err)
    }
}

Phase 2: Create API Gateway

2.1 API Gateway Structure

backend/
├── api-gateway/
│   ├── main.go           # Gateway server entry point
│   ├── handlers/         # HTTP to gRPC translation
│   │   ├── meals.go
│   │   ├── agent.go
│   │   └── mealplan.go
│   ├── clients/          # gRPC client connections
│   │   ├── backend.go
│   │   └── agent.go
│   └── middleware/       # Auth, logging, tracing
│       ├── logging.go
│       └── cors.go
├── backend-service/      # Renamed from backend/
│   ├── main.go          # gRPC server
│   └── ... (existing files)
└── proto/               # Shared protobuf definitions
    └── meal_planner.proto

2.2 Gateway Implementation

File: backend/api-gateway/main.go
func main() {
    // Connect to backend gRPC service
    backendConn, err := grpc.Dial("localhost:9090", grpc.WithInsecure())
    if err != nil {
        log.Fatalf("Failed to connect to backend: %v", err)
    }
    defer backendConn.Close()
    
    backendClient := proto.NewBackendServiceClient(backendConn)
    
    // Setup HTTP routes
    r := chi.NewRouter()
    r.Use(middleware.Logger)
    r.Use(middleware.CORS)
    
    // Backend routes
    r.Get("/api/meals", handlers.GetAllMeals(backendClient))
    r.Post("/api/meals", handlers.CreateMeal(backendClient))
    r.Get("/api/mealplan", handlers.GetMealPlan(backendClient))
    
    // Agent routes (will proxy to agent service in Phase 3)
    r.Post("/api/agent/start", handlers.StartAgent(nil)) // placeholder
    
    log.Printf("API Gateway listening on :8080")
    http.ListenAndServe(":8080", r)
}

2.3 Gateway Handlers

File: backend/api-gateway/handlers/meals.go
func GetAllMeals(client proto.BackendServiceClient) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        req := &proto.GetAllMealsRequest{}
        
        resp, err := client.GetAllMeals(r.Context(), req)
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        
        // Convert proto to JSON
        meals := convertProtoMealsToJSON(resp.Meals)
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(meals)
    }
}

Phase 3: Create Agent Service

3.1 Agent Service Proto

File: proto/agent_service.proto
syntax = "proto3";
package agent;
option go_package = "mealplanner/proto";

service AgentService {
rpc StartWorkflow(StartWorkflowRequest) returns (WorkflowResponse);
rpc AddFeedback(FeedbackRequest) returns (WorkflowResponse);
rpc ResumeWorkflow(ResumeWorkflowRequest) returns (WorkflowResponse);
rpc GetWorkflowStatus(GetStatusRequest) returns (StatusResponse);
}

message StartWorkflowRequest {
repeated string participants = 1;
}

message WorkflowResponse {
bool success = 1;
string message = 2;
string thread_id = 3;
string current_step = 4;
}

3.2 TypeScript Agent gRPC Server

File: typescript/agent-service/server.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { LangGraphAgent } from '../agent/langgraph-agent';

const packageDefinition = protoLoader.loadSync('../../proto/agent_service.proto');
const agentProto = grpc.loadPackageDefinition(packageDefinition).agent as any;

class AgentServiceImpl {
private agent: LangGraphAgent;

constructor() {
    this.agent = new LangGraphAgent(config);
}

async startWorkflow(call: any, callback: any) {
    try {
    const result = await this.agent.startMealPlanningWorkflow(call.request.participants);
    callback(null, {
        success: true,
        message: result.message,
        thread_id: result.threadId,
        current_step: result.currentStep
    });
    } catch (error) {
    callback(null, { success: false, message: error.message });
    }
}
}

const server = new grpc.Server();
server.addService(agentProto.AgentService.service, new AgentServiceImpl());
server.bindAsync('0.0.0.0:9091', grpc.ServerCredentials.createInsecure(), () => {
console.log('Agent gRPC server listening on :9091');
server.start();
});

3.3 Update API Gateway for Agent Routes

File: backend/api-gateway/handlers/agent.go
func StartAgent(client agentproto.AgentServiceClient) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        var req struct {
            Participants []string `json:"participants"`
        }
        json.NewDecoder(r.Body).Decode(&req)
        
        grpcReq := &agentproto.StartWorkflowRequest{
            Participants: req.Participants,
        }
        
        resp, err := client.StartWorkflow(r.Context(), grpcReq)
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(resp)
    }
}

Phase 4: Local Development Setup

4.1 Docker Compose for Development

File: docker-compose.dev.yml
version: '3.8'
services:
postgres:
    image: postgres:13
    environment:
    POSTGRES_DB: meal_planner_dev
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: password
    ports:
    - "5432:5432"

backend-service:
    build: 
    context: ./backend/backend-service
    dockerfile: Dockerfile.dev
    ports:
    - "9090:9090"
    depends_on:
    - postgres
    environment:
    DB_HOST: postgres

agent-service:
    build:
    context: ./typescript/agent-service
    dockerfile: Dockerfile.dev
    ports:
    - "9091:9091"
    environment:
    BACKEND_GRPC_URL: backend-service:9090

api-gateway:
    build:
    context: ./backend/api-gateway
    dockerfile: Dockerfile.dev
    ports:
    - "8080:8080"
    depends_on:
    - backend-service
    - agent-service
    environment:
    BACKEND_GRPC_URL: backend-service:9090
    AGENT_GRPC_URL: agent-service:9091

4.2 Development Scripts

File: scripts/dev-services.js
const { spawn } = require('child_process');

// Start all services in development mode
const services = [
{ name: 'postgres', cmd: 'docker-compose', args: ['up', 'postgres'] },
{ name: 'backend', cmd: 'go', args: ['run', './backend/backend-service'], cwd: '.' },
{ name: 'agent', cmd: 'npm', args: ['run', 'dev'], cwd: './typescript/agent-service' },
{ name: 'gateway', cmd: 'go', args: ['run', './backend/api-gateway'], cwd: '.' },
{ name: 'frontend', cmd: 'npm', args: ['start'], cwd: './typescript/ui' }
];

services.forEach(service => {
console.log(`Starting ${service.name}...`);
const proc = spawn(service.cmd, service.args, { 
    cwd: service.cwd || process.cwd(),
    stdio: 'inherit'
});
proc.on('error', (err) => console.error(`${service.name} error:`, err));
});

4.3 Update Agent CLI

File: typescript/agent/cli.ts
// Replace direct agent calls with HTTP calls to API Gateway
async function startWorkflow(participants: string[]) {
const response = await fetch('http://localhost:8080/api/agent/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participants })
});
return response.json();
}

Phase 5: Testing & Debugging Setup

5.1 Health Check Endpoints

Each service gets /health endpoint for monitoring:
- Backend Service: :9090/health (gRPC health check)
- Agent Service: :9091/health (gRPC health check) 
- API Gateway: :8080/health (HTTP health check)

5.2 Logging & Correlation

Each request should receive a unique correlation ID generated at the API Gateway and propagated via gRPC metadata. All services must write structured logs containing this ID, the method name, HTTP status (where applicable), and duration. This provides end-to-end traceability without introducing OpenTelemetry at this stage.

Implement OpenTelemetry tracing across all services:
- Generate trace ID at API Gateway
- Propagate through gRPC metadata
- Log trace ID in all services

5.3 Development Tools

- gRPC-UI for testing gRPC services directly
- Postman collection for API Gateway endpoints
- Docker logs aggregation for debugging

Benefits for Debugging

1. Single entry point - All requests go through API Gateway
2. Service isolation - Can test each gRPC service independently
3. Type safety - Protobuf prevents interface mismatches
4. Correlated logs - End-to-end visibility
5. Health monitoring - Easy to see which service is failing