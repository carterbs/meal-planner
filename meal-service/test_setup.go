package main

import (
	"os"
	"testing"

	"mealplanner/logging"
)

// setupTestEnvironment configures the test environment without logging service
func setupTestEnvironment(t *testing.T) {
	// Reset logging for tests
	logging.ResetForTest()

	// Set environment variable to disable gRPC logging during tests
	originalEnv := os.Getenv("DISABLE_GRPC_LOGGING")
	os.Setenv("DISABLE_GRPC_LOGGING", "true")

	t.Cleanup(func() {
		// Restore original environment
		if originalEnv == "" {
			os.Unsetenv("DISABLE_GRPC_LOGGING")
		} else {
			os.Setenv("DISABLE_GRPC_LOGGING", originalEnv)
		}
		// Reset logging after tests
		logging.ResetForTest()
	})
}
