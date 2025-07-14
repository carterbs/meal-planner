Implementation Plan: API Gateway → gRPC Backend Migration

  Current State Analysis

  - API Gateway: Simple HTTP proxy forwarding all requests to backend on port 8090
  - Backend: Full-featured HTTP server with Chi router handling all business logic
  - Proto Definition: Complete gRPC service definition already exists (MealPlannerAPI) with all endpoints
  - Generated Code: gRPC client/server code already generated in generated/go/
  - e2e flow is currently broken. So we can be pretty reckless in our implementation speed.

  Phase 1 [DONE]: Backend gRPC Server Implementation

  1. Create gRPC server
    - Add gRPC server listening on port 50051
    - Implement MealPlannerAPI service interface
    - Wrap existing handlers/services to work with protobuf messages

  Phase 2 [DONE]: API Gateway gRPC Client Implementation

  3. Replace proxy with gRPC client calls
    - Remove HTTP proxy functionality from api-gateway/main.go
    - Add gRPC client initialization to connect to backend:50051
    - Implement HTTP endpoint handlers that call corresponding gRPC methods
    - Add request/response translation (HTTP JSON ↔ protobuf)
  4. Error Handling & Middleware
    - Port CORS, logging, and error handling from backend to gateway
    - Implement gRPC status code to HTTP status code mapping

  Phase 3: Testing & Migration

  5. Integration Testing
    - Verify all endpoints work through new gRPC flow via yarn test:e2e
  6. Cleanup & Optimization
    - Remove HTTP server from backend (keep only gRPC)
    - Add gRPC health checks

  Key Implementation Details

  Backend Changes:
  - Add gRPC server on port 50051
  - Create service implementations that delegate to existing business logic
  - Convert between internal models and protobuf messages

  API Gateway Changes:
  - Replace httputil.ReverseProxy with gRPC client calls
  - Implement HTTP handlers that translate requests and call backend gRPC methods
  - Handle protobuf serialization/deserialization
