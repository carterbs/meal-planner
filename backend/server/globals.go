package server

import (
	"database/sql"
	"mealplanner/services"
)

// Global variables that were previously in the handlers package
var (
	DB              *sql.DB
	Services        *services.ServiceContainer
	WorkflowService services.WorkflowService
)
