package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// Config holds database connection parameters
type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	// Connection parameters
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
	// Timeout configs
	ConnectTimeout time.Duration
	PingTimeout    time.Duration
}

// DefaultConfig returns a configuration with reasonable defaults
func DefaultConfig() Config {
	return Config{
		Host:            "localhost",
		Port:            "5432",
		MaxOpenConns:    25,
		MaxIdleConns:    10,
		ConnMaxLifetime: 5 * time.Minute,
		ConnMaxIdleTime: 1 * time.Minute,
		ConnectTimeout:  5 * time.Second,
		PingTimeout:     3 * time.Second,
	}
}

// Validate checks if the required config fields are provided
func (c *Config) Validate() error {
	if c.Host == "" {
		return errors.New("database host is required")
	}
	if c.Port == "" {
		return errors.New("database port is required")
	}
	if c.User == "" {
		return errors.New("database user is required")
	}
	if c.DBName == "" {
		return errors.New("database name is required")
	}
	return nil
}

// ConnectionError represents a database connection error with a user-friendly message
type ConnectionError struct {
	Original error
	Message  string
}

func (e *ConnectionError) Error() string {
	return fmt.Sprintf("%s: %v", e.Message, e.Original)
}

// ConnectDB establishes a connection to the database with improved error handling
func ConnectDB(cfg Config) (*sql.DB, error) {
	// Validate config
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid database configuration: %w", err)
	}

	// Create connection string
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName,
	)

	// Open connection
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, &ConnectionError{
			Original: err,
			Message:  "Failed to establish database connection. Make sure your Docker container is running",
		}
	}

	// Configure connection pool
	if cfg.MaxOpenConns > 0 {
		db.SetMaxOpenConns(cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns > 0 {
		db.SetMaxIdleConns(cfg.MaxIdleConns)
	}
	if cfg.ConnMaxLifetime > 0 {
		db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	}
	if cfg.ConnMaxIdleTime > 0 {
		db.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)
	}

	// Verify connection is actually working with a timeout
	pingTimeout := cfg.PingTimeout
	if pingTimeout == 0 {
		pingTimeout = 3 * time.Second
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), pingTimeout)
	defer cancel()
	
	if err := db.PingContext(ctx); err != nil {
		db.Close() // Close the connection before returning the error
		return nil, &ConnectionError{
			Original: err,
			Message:  "Failed to connect to database. Please make sure Docker is running and the database container is started",
		}
	}

	return db, nil
}

// IsConnectionError checks if an error is related to database connectivity
func IsConnectionError(err error) bool {
	if err == nil {
		return false
	}
	
	// Check if it's our custom type first
	var connErr *ConnectionError
	if errors.As(err, &connErr) {
		return true
	}
	
	// Common PostgreSQL connection error messages
	connectionErrors := []string{
		"connection refused",
		"connection reset by peer", 
		"connection timed out",
		"no connection to the server",
		"the database system is starting up",
		"the database system is shutting down",
		"dial tcp",
		"broken pipe",
	}
	
	errMsg := err.Error()
	for _, msg := range connectionErrors {
		if strings.Contains(errMsg, msg) {
			return true
		}
	}
	
	return false
}
