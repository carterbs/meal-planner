# Meal Planner

A full-stack application for planning weekly meals, generating shopping lists, and managing recipes.

## Overview

The Meal Planner helps users:
- Generate weekly meal plans based on cooking effort preferences
- Limit red meat consumption
- Avoid repeating meals from recent weeks
- Create shopping lists for planned meals
- Manage a collection of recipes with step-by-step instructions

## Technology Stack

- **Backend**: Go with PostgreSQL database
- **Frontend**: React TypeScript with Material UI

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js and Yarn
- Go 1.20 or higher

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd meal-planner
```

2. Start the database using Docker
```bash
docker-compose up -d
```

3. Install dependencies and start the application
```bash
yarn
yarn start
```

4. Optional: Seed the database with sample data
```bash
cd backend
go run main.go --seed
```

## Project Structure

- `backend/` - Go backend server
- `frontend/` - React TypeScript frontend
- `docs/` - Project documentation
- `scripts/` - Utility scripts for development

## Documentation

Comprehensive documentation is available in the [docs](./docs) directory:

- [Complete System Overview](./docs/MealPlannerSummary.md) - Detailed documentation of both backend and frontend

## Development

Start the development servers:

```bash
# Start both frontend and backend servers
yarn start

# Start only the backend server
cd backend
go run main.go

# Start only the frontend server
cd frontend
yarn start
```

## Testing

To run all tests for both the frontend and backend simultaneously:

```bash
yarn test
```

To run only backend tests:

```bash
yarn test:backend
```

To run only frontend tests:

```bash
yarn test:frontend
```

To run tests with a concise, easy-to-read summary report:

```bash
yarn test:summary
```

## Database Management

```bash
# Backup the database
yarn db:backup

# Restore the database
yarn db:restore
```