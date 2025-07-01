# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Workflow
- `yarn start` - Start both frontend and backend servers concurrently
- `yarn dev` - Alternative development command
- `yarn test` - Run all tests with summary report
- `yarn test:frontend` - Frontend tests only
- `yarn test:backend` - Backend tests only (`cd backend && go test -v ./...`)

### MCP Server Development
- `cd backend/mcp && yarn build` - Build MCP TypeScript server
- `cd backend/mcp && yarn start` - Run built MCP server (stdio)
- `cd backend/mcp && yarn dev` - Run MCP server in development mode with nodemon
- `cd backend/mcp && yarn test` - Run MCP server tests

### Database Management
- `docker-compose up -d` - Start PostgreSQL database
- `yarn db:backup` - Create timestamped database backup
- `yarn db:restore` - Restore from backup (interactive)

### Backend Testing & Coverage
- `cd backend && make test` - Run Go tests
- `cd backend && make coverage` - Generate coverage report
- `cd backend && make coverage-html` - Open HTML coverage report

### Frontend Testing
- `cd frontend && yarn test` - Run React tests (uses `--watchAll=false`)
- `cd frontend && yarn test:watch` - Run tests in watch mode
- `cd frontend && yarn coverage` - Generate test coverage

## Architecture Overview

**Full-stack meal planning application with Go backend, React TypeScript frontend, and MCP (Model Context Protocol) server integration.**

### Backend (Go)
- **Structure**: Layered architecture with handlers → models → database
- **Database**: PostgreSQL with migration support
- **Key Models**: Meal, Ingredient, Step, MealPlan, ShoppingList
- **API**: RESTful endpoints with chi router
- **Testing**: High test coverage using Go's native testing + sqlmock

### Frontend (React + TypeScript)
- **UI Framework**: Material UI v6 (@mui/material)
- **Data Grid**: @mui/x-data-grid for tabular data
- **Drag & Drop**: @dnd-kit for meal planning interface
- **State Management**: React hooks with local state
- **Proxy**: Configured to proxy API calls to localhost:8080

### MCP Server (TypeScript)
- **Location**: `backend/mcp/` - TypeScript MCP server implementation
- **Transport**: Standard input/output (stdio)
- **Framework**: none (uses MCP SDK directly)
- **Protocol**: Model Context Protocol
- **Tools**: Currently implements basic "hello" tool as scaffold
- **Validation**: Uses Zod for input validation
- **Testing**: Jest with comprehensive tool logic tests

### Key Features
- Weekly meal planning with effort-based filtering
- Red meat consumption tracking
- Shopping list generation from meal plans
- Recipe management with step-by-step instructions
- Calendar export (.ics format)
- Database backup/restore utilities
- MCP server for AI tool integration

## Development Notes

- **Package Manager**: Always use `yarn`, never npm
- **Testing**: Follow Fix-Test-Commit workflow (see typescript/frontend/CLAUDE.md)
- **Database**: Can run with `--dummy` flag for in-memory data during development
- **Environment**: Backend requires database credentials via .env file or environment variables
- **MCP Architecture**: The MCP server runs independently and provides tools for AI integration with the meal planning system
- **Workspaces**: Project uses yarn workspaces with frontend and backend/mcp as separate packages

## Testing Requirements

Tests must cover:
- Unit tests for models and handlers (Go backend)
- Component rendering and user interactions (React frontend)
- MCP tool logic and server functionality (TypeScript MCP server)
- API integration tests
- Edge cases and error conditions
- Database operations with proper mocking


# Claude Development Procedures

## Git & GitHub Permissions

Claude has full permission to use the following commands without asking:
- `git status` - Check repository status
- `git add` - Stage files for commit
- `git commit` - Create commits with descriptive messages
- `git push` - Push commits to remote repository
- `gh` CLI commands - Create pull requests, manage issues, etc.

Claude should proactively use these commands when working on tasks that benefit from version control.

## Custom Slash Commands

### /commit
If on main, create a new branch. Once on a feature branch, commit code with a descriptive message. 

### /commit-push-pr
Run /commit, then push the branch and create the PR using the `gh` cli. 

