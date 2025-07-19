## Decouple backend service from agent service
Remove usage of the agentClient in the backend by moving the endpoints that use the client from the backend to the agent-service. Create new gRPC endpoints that handle requests from the API gateway (e.g., StartAgentWorkflow), invoking existing functionality where the backend was previously calling the agent service. Then move the API gateway to calling the agent service directly for those http endpoints.

At this point the agent service and backend service will be totally independent.

## Rename backend service
Then rename the backend service to meal-service. 

## Delete dead code
With the agent service alive and well, we should delete dead code from the backend. Tests + runtime code.

## Clean up protos
Remove agent-specific stuff from the backend protos.

## Move MCP into the root of the repo
Move the server

## Move ui into the root of the repo
Delete the typescript folder as a thing.

## Be better with stdiotransport
Reuse one stdiotransport rather than creating it for each agent session

## Clean up logging
The verbose logging is useful when debugging e2e tests. Figure out how to make it minimal in most cases. Maybe move some infos to debugs

## AST transform for making sure we await all logs in typescript
Without this, it's possible for logs to appear in the file out of order, which is annoying and makes you trust nothing.

## Add back meal management access to the app
Let users modify meals (e.g., i need to add buns to the main burger meal)