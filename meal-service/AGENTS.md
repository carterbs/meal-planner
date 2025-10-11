# `meal-service` – Meal planning microservice in Go

## Purpose

The meal service is a Go gRPC microservice responsible for creating,
updating and retrieving meals, recipes and meal plans.  It persists data
in a PostgreSQL database and exposes methods defined in
`proto/meal.proto`.  This service encapsulates all meal‑related business
logic; other services interact with it via gRPC or through the API
gateway.

## Implementation guidelines

1. **Separation of concerns.**  Keep handlers thin and delegate all
   business logic to services.  Keep persistence logic isolated.
2. **Validation.**  Validate request payloads in handlers.  Reject
   invalid data with gRPC error codes (e.g. `InvalidArgument`).
5. **Plan mode.**  When adding new RPCs or features, start in plan
   mode: design the API, update `proto/meal.proto`, regenerate stubs,
   implement handlers and tests.
6. **Error handling.**  Convert database errors into appropriate gRPC
   status codes.  Log detailed errors via the logging service while
   returning a concise message to clients.
7. **Validation.**  Use the validate tool for testing, linting, and building: `yarn test|lint|build --service meal-service`

## Testing guidelines

- **Avoid global logger initialization.** Use lazy initialization functions like `getMyLogger()` instead of global variables like `var myLogger = logging.GetGrpcLogger("name")` to prevent tests from hanging on gRPC connections.
- **Use `setupTestEnvironment(t)`** in main package tests to disable gRPC logging during tests.
- **Package-level tests** should set `os.Setenv("DISABLE_GRPC_LOGGING", "true")` in an `init()` function to prevent connection attempts.
- **No untagged integration tests.** Do not add tests that require a live database or Docker inside the default build. If a real Postgres scenario is unavoidable, gate it behind `//go:build integration`, keep it optional, and rely on `sqlmock`/repository mocks for the primary suite.

## Adding a new RPC

1. Update `proto/meal.proto` with the new RPC definition, including
   request and response messages.  Assign unique field numbers.
2. Run `yarn generate_code` from the root of the repo to regenerate stubs in both Go and TypeScript.
3. Implement a handler in `internal/handlers`.
4. Write unit tests covering the service and storage layers.
5. Update the API gateway to expose the new endpoint.
6. Run `yarn test lint build --service meal-service` from the root of the repo before committing.
