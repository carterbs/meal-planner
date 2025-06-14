# MCP Server Implementation Plan

## Overview
Set up a new MCP (Model Context Protocol) server in `backend/mcp/` with TypeScript, following the plan specifications.

## Steps

### 1. Create MCP Directory Structure ✅
- Create `backend/mcp/` directory
- Initialize new yarn workspace in that directory

### 2. Package Initialization  
- Run `yarn init` in `backend/mcp/` to create package.json
- Configure package.json with:
  - Name: "mealplanner-mcp"
  - Version: "1.0.0" 
  - Type: "module" (for ES modules)
  - Scripts for build, start, and test

### 3. Install Dependencies
**Core Dependencies:**
- `@modelcontextprotocol/sdk` - Official MCP TypeScript SDK
- `express` - HTTP server for SSE transport
- `cors` - CORS middleware for Express

**Development Dependencies:**
- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `@types/express` - Express type definitions  
- `@types/cors` - CORS type definitions
- `tsx` - TypeScript execution for development
- `nodemon` - Development file watcher

### 4. TypeScript Configuration
- Create `tsconfig.json` with:
  - ES2022 target for modern Node.js
  - Module resolution bundler
  - Strict type checking enabled
  - Output directory for compiled JS

### 5. Create Hello World MCP Server
- Create `src/index.ts` with:
  - Express server setup with CORS
  - MCP server initialization using HTTP+SSE transport
  - Simple "hello" tool that returns "Hi from MealPlanner MCP!"
  - Health check endpoint at `/health`
  - Server listening on port 3001

### 6. Add Build Scripts
**package.json scripts:**
- `build` - Compile TypeScript to JavaScript
- `start` - Run compiled server
- `dev` - Development mode with nodemon and tsx
- `test` - Basic server connection test

### 7. Development Testing Setup
- Create simple test to verify server starts and responds
- Add documentation for running and testing the server

## File Structure After Completion
```
backend/mcp/
├── package.json
├── tsconfig.json  
├── src/
│   └── index.ts
├── dist/ (after build)
└── node_modules/
```

## Expected Outcome
- Working MCP server on `http://localhost:3001`
- Hello world tool accessible via MCP protocol
- Ready for extension with meal planner functionality
- Integrated with existing project structure

## Dependencies Required
Based on research from the MCP server plan:

### Node.js Environment
- Node.js 18+ (runtime requirement)
- npm or yarn (package manager)

### MCP SDK
- `@modelcontextprotocol/sdk` (official TypeScript MCP SDK)

### Transport Method
- HTTP + Server-Sent Events (SSE) transport (not stdio as specified in plan)
- Express.js (for HTTP server mounting)

### TypeScript Development
- TypeScript compiler and related type definitions
- Development tools for file watching and execution