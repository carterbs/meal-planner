Plan: Remove writeJSON and Use protojson Everywhere
 
Step 1: Create protobuf equivalents for missing types
- Create protobuf definitions for AgentResponse, WorkflowStatus, and other non-protobuf types currently being returned
- Add these to the api.proto file and regenerate Go types
 
Step 2: Update agent handler responses 
 
- Replace all models.AgentResponse returns with new protobuf equivalent
- run yarn proto:gen to generate new types
- Update the runAgentCLI function to unmarshal into protobuf types
- Ensure all agent handlers return protobuf types
 
Step 3: Replace writeJSON calls systematically
- handlers/agent.go: 5 calls - replace with direct protojson.Marshal() + w.Write() 
- handlers/mealplan.go: 1 call - replace with protojson.Marshal() + w.Write() 
- handlers/workflows.go: 4 calls - replace with protojson.Marshal() + w.Write() 
 
Step 4: Remove writeJSON function
- Delete the writeJSON function entirely from handlers/agent.go 
- Clean up any unused imports

Step 5: Test and validate 
- Run existing UNIT tests to ensure no regressions