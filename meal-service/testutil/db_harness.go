//go:build integration
// +build integration

package testutil

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"mealplanner/db"

	_ "github.com/lib/pq"
)

// DBHarness manages test database connections and cleanup
type DBHarness struct {
	DB           *sql.DB
	t            *testing.T
	testDBName   string
	cleanupFuncs []func()
}

// SetupTestDB creates a test database connection with migrations
func SetupTestDB(t *testing.T) *DBHarness {
	t.Helper()

	// Check if we should skip integration tests
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Get database config from environment
	cfg := db.Config{
		Host:            getEnvOrDefault("DB_HOST", "localhost"),
		Port:            getEnvOrDefault("DB_PORT", "5432"),
		User:            getEnvOrDefault("DB_USER", "mealuser"),
		Password:        getEnvOrDefault("DB_PASSWORD", "mealpass"),
		DBName:          getEnvOrDefault("DB_NAME", "mealplanner_test"),
		MaxOpenConns:    5,
		MaxIdleConns:    2,
		ConnMaxLifetime: 5 * time.Minute,
		ConnMaxIdleTime: 1 * time.Minute,
		ConnectTimeout:  5 * time.Second,
		PingTimeout:     3 * time.Second,
	}

	// Connect to database
	database, err := db.ConnectDB(cfg)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v\nMake sure PostgreSQL is running and DB_NAME=%s exists", err, cfg.DBName)
	}

	harness := &DBHarness{
		DB:           database,
		t:            t,
		testDBName:   cfg.DBName,
		cleanupFuncs: []func(){},
	}

	// Register cleanup
	t.Cleanup(func() {
		harness.Cleanup()
	})

	return harness
}

// RunMigrations executes SQL migrations from the migrations directory
func (h *DBHarness) RunMigrations() error {
	h.t.Helper()

	// Get the migrations directory path
	migrationsDir := filepath.Join("..", "..", "meal-service", "migrations")
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		// Try alternative path for when running from different location
		migrationsDir = filepath.Join("migrations")
	}

	// Read and execute migration 009
	migrationFile := filepath.Join(migrationsDir, "009_activate_meal_plans.up.sql")
	migrationSQL, err := os.ReadFile(migrationFile)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = h.DB.ExecContext(ctx, string(migrationSQL))
	if err != nil {
		return fmt.Errorf("failed to execute migration: %w", err)
	}

	return nil
}

// CleanupTables removes all data from test tables
func (h *DBHarness) CleanupTables() error {
	h.t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Delete in correct order to respect foreign key constraints
	tables := []string{
		"meal_plan_items",
		"meal_plans",
	}

	for _, table := range tables {
		_, err := h.DB.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s", table))
		if err != nil {
			return fmt.Errorf("failed to cleanup table %s: %w", table, err)
		}
	}

	return nil
}

// ResetSequences resets auto-increment sequences for tables
func (h *DBHarness) ResetSequences() error {
	h.t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	sequences := map[string]string{
		"meal_plans_id_seq":      "meal_plans",
		"meal_plan_items_id_seq": "meal_plan_items",
	}

	for seqName, tableName := range sequences {
		query := fmt.Sprintf("ALTER SEQUENCE %s RESTART WITH 1", seqName)
		_, err := h.DB.ExecContext(ctx, query)
		if err != nil {
			// Sequence might not exist yet, which is okay
			h.t.Logf("Warning: failed to reset sequence %s for table %s: %v", seqName, tableName, err)
		}
	}

	return nil
}

// ExecuteInTransaction executes a function within a transaction
func (h *DBHarness) ExecuteInTransaction(fn func(*sql.Tx) error) error {
	h.t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tx, err := h.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	err = fn(tx)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

// AddCleanupFunc registers a cleanup function to run during test teardown
func (h *DBHarness) AddCleanupFunc(fn func()) {
	h.cleanupFuncs = append(h.cleanupFuncs, fn)
}

// Cleanup closes database connection and runs cleanup functions
func (h *DBHarness) Cleanup() {
	// Run cleanup functions in reverse order
	for i := len(h.cleanupFuncs) - 1; i >= 0; i-- {
		h.cleanupFuncs[i]()
	}

	if h.DB != nil {
		h.DB.Close()
	}
}

// BeginTestTransaction starts a transaction for isolated test execution
func (h *DBHarness) BeginTestTransaction() (*sql.Tx, error) {
	h.t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tx, err := h.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin test transaction: %w", err)
	}

	// Register rollback cleanup
	h.t.Cleanup(func() {
		tx.Rollback()
	})

	return tx, nil
}

// AssertTableExists verifies that a table exists in the database
func (h *DBHarness) AssertTableExists(tableName string) error {
	h.t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = $1
		)
	`

	var exists bool
	err := h.DB.QueryRowContext(ctx, query, tableName).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if table exists: %w", err)
	}

	if !exists {
		return fmt.Errorf("table %s does not exist", tableName)
	}

	return nil
}

// AssertEnumExists verifies that an enum type exists in the database
func (h *DBHarness) AssertEnumExists(enumName string) error {
	h.t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT EXISTS (
			SELECT FROM pg_type
			WHERE typname = $1
		)
	`

	var exists bool
	err := h.DB.QueryRowContext(ctx, query, enumName).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if enum exists: %w", err)
	}

	if !exists {
		return fmt.Errorf("enum type %s does not exist", enumName)
	}

	return nil
}

// AssertIndexExists verifies that an index exists in the database
func (h *DBHarness) AssertIndexExists(indexName string) error {
	h.t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT EXISTS (
			SELECT FROM pg_indexes
			WHERE indexname = $1
		)
	`

	var exists bool
	err := h.DB.QueryRowContext(ctx, query, indexName).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if index exists: %w", err)
	}

	if !exists {
		return fmt.Errorf("index %s does not exist", indexName)
	}

	return nil
}

// AssertTriggerExists verifies that a trigger exists in the database
func (h *DBHarness) AssertTriggerExists(triggerName string) error {
	h.t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT EXISTS (
			SELECT FROM pg_trigger
			WHERE tgname = $1
		)
	`

	var exists bool
	err := h.DB.QueryRowContext(ctx, query, triggerName).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if trigger exists: %w", err)
	}

	if !exists {
		return fmt.Errorf("trigger %s does not exist", triggerName)
	}

	return nil
}

// Helper function to get environment variable with default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
