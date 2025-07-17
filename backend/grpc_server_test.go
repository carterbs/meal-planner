//go:build legacy
// +build legacy

package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apipb "mealplanner/generated/go"
	"mealplanner/server"
	"mealplanner/services"
)

func TestGetCheckpoint_MessageConversion(t *testing.T) {
	// Store original DB for restoration
	originalDB := server.DB
	originalServices := server.Services

	t.Cleanup(func() {
		// Restore original DB and services after test
		server.DB = originalDB
		server.Services = originalServices
	})

	// Create mock database
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to create mock db: %v", err)
	}
	defer db.Close()

	// Set up server with mock DB
	server.DB = db
	server.Services = services.NewServiceContainer(db)

	t.Run("checkpoint with messages", func(t *testing.T) {
		// Create test checkpoint data with messages in the format we store
		checkpointData := map[string]interface{}{
			"state": map[string]interface{}{
				"current_step":     "generate_plan",
				"thread_id":        "test-thread-123",
				"participants":     []string{"user"},
				"iteration_count":  1,
				"is_finalized":     false,
			},
			"messages": []interface{}{
				map[string]interface{}{
					"sender": "user",
					"text":   "I want to plan meals for this week",
					"time":   "2023-12-01T10:00:00Z",
				},
				map[string]interface{}{
					"sender": "agent",
					"text":   "I'll help you create a meal plan. Let me start by generating some options.",
					"time":   "2023-12-01T10:00:30Z",
				},
			},
			"next": []interface{}{},
			"step": 1,
		}

		checkpointBytes, _ := json.Marshal(checkpointData)

		// Set up mock expectations
		mock.ExpectQuery("SELECT checkpoint_data, checkpoint_ns FROM workflow_checkpoints").
			WithArgs("test-thread-123").
			WillReturnRows(sqlmock.NewRows([]string{"checkpoint_data", "checkpoint_ns"}).
				AddRow(checkpointBytes, "latest"))

		// Create gRPC server instance
		server := &MealPlannerAPIServer{}

		// Call GetCheckpoint
		resp, err := server.GetCheckpoint(context.Background(), &apipb.GetCheckpointRequest{
			ThreadId: "test-thread-123",
		})

		// Verify response
		if err != nil {
			t.Fatalf("GetCheckpoint failed: %v", err)
		}

		if !resp.Found {
			t.Fatal("Expected checkpoint to be found")
		}

		if resp.Tuple == nil || resp.Tuple.Checkpoint == nil {
			t.Fatal("Expected checkpoint tuple to be populated")
		}

		checkpoint := resp.Tuple.Checkpoint

		// Verify messages were converted correctly
		if len(checkpoint.Messages) != 2 {
			t.Fatalf("Expected 2 messages, got %d", len(checkpoint.Messages))
		}

		// Check first message (user)
		msg1 := checkpoint.Messages[0]
		if msg1.ThreadId != "test-thread-123" {
			t.Errorf("Expected ThreadId 'test-thread-123', got '%s'", msg1.ThreadId)
		}
		if msg1.Sender != "user" {
			t.Errorf("Expected Sender 'user', got '%s'", msg1.Sender)
		}
		if msg1.Content != "I want to plan meals for this week" {
			t.Errorf("Expected Content 'I want to plan meals for this week', got '%s'", msg1.Content)
		}
		if msg1.CreatedAt != "2023-12-01T10:00:00Z" {
			t.Errorf("Expected CreatedAt '2023-12-01T10:00:00Z', got '%s'", msg1.CreatedAt)
		}

		// Check second message (agent)
		msg2 := checkpoint.Messages[1]
		if msg2.Sender != "agent" {
			t.Errorf("Expected Sender 'agent', got '%s'", msg2.Sender)
		}
		if msg2.Content != "I'll help you create a meal plan. Let me start by generating some options." {
			t.Errorf("Expected Content 'I'll help you create a meal plan. Let me start by generating some options.', got '%s'", msg2.Content)
		}

		// Verify state was also parsed correctly
		if checkpoint.State == nil {
			t.Fatal("Expected checkpoint state to be populated")
		}
		if checkpoint.State.CurrentStep != "generate_plan" {
			t.Errorf("Expected CurrentStep 'generate_plan', got '%s'", checkpoint.State.CurrentStep)
		}
	})

	t.Run("checkpoint without messages", func(t *testing.T) {
		// Create test checkpoint data without messages
		checkpointData := map[string]interface{}{
			"state": map[string]interface{}{
				"current_step":     "initial",
				"thread_id":        "test-thread-456",
				"participants":     []string{"user"},
				"iteration_count":  1,
				"is_finalized":     false,
			},
			"next": []interface{}{},
			"step": 0,
		}

		checkpointBytes, _ := json.Marshal(checkpointData)

		// Set up mock expectations
		mock.ExpectQuery("SELECT checkpoint_data, checkpoint_ns FROM workflow_checkpoints").
			WithArgs("test-thread-456").
			WillReturnRows(sqlmock.NewRows([]string{"checkpoint_data", "checkpoint_ns"}).
				AddRow(checkpointBytes, "latest"))

		// Create gRPC server instance
		server := &MealPlannerAPIServer{}

		// Call GetCheckpoint
		resp, err := server.GetCheckpoint(context.Background(), &apipb.GetCheckpointRequest{
			ThreadId: "test-thread-456",
		})

		// Verify response
		if err != nil {
			t.Fatalf("GetCheckpoint failed: %v", err)
		}

		if !resp.Found {
			t.Fatal("Expected checkpoint to be found")
		}

		checkpoint := resp.Tuple.Checkpoint

		// Verify empty messages array
		if len(checkpoint.Messages) != 0 {
			t.Fatalf("Expected 0 messages, got %d", len(checkpoint.Messages))
		}

		// Verify state was parsed correctly
		if checkpoint.State.CurrentStep != "initial" {
			t.Errorf("Expected CurrentStep 'initial', got '%s'", checkpoint.State.CurrentStep)
		}
	})

	t.Run("checkpoint not found", func(t *testing.T) {
		// Set up mock expectations for not found
		mock.ExpectQuery("SELECT checkpoint_data, checkpoint_ns FROM workflow_checkpoints").
			WithArgs("nonexistent-thread").
			WillReturnError(sql.ErrNoRows)

		// Create gRPC server instance
		server := &MealPlannerAPIServer{}

		// Call GetCheckpoint
		_, err := server.GetCheckpoint(context.Background(), &apipb.GetCheckpointRequest{
			ThreadId: "nonexistent-thread",
		})

		// Verify response - should get an error because workflow service returns error for not found
		if err == nil {
			t.Fatal("GetCheckpoint should return error for not found thread")
		}

		// Check that the error message contains expected text
		expectedErrText := "failed to get checkpoint"
		if err.Error()[:len(expectedErrText)] != expectedErrText {
			t.Errorf("Expected error to start with '%s', got '%s'", expectedErrText, err.Error())
		}
	})

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("There were unfulfilled expectations: %s", err)
	}
}

func TestGetCheckpoint_EmptyMessages(t *testing.T) {
	// Store original DB for restoration
	originalDB := server.DB
	originalServices := server.Services

	t.Cleanup(func() {
		server.DB = originalDB
		server.Services = originalServices
	})

	// Create mock database
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to create mock db: %v", err)
	}
	defer db.Close()

	server.DB = db
	server.Services = services.NewServiceContainer(db)

	t.Run("checkpoint with empty messages array", func(t *testing.T) {
		// Create test checkpoint data with empty messages array
		checkpointData := map[string]interface{}{
			"state": map[string]interface{}{
				"current_step": "initial",
				"thread_id":    "test-thread-789",
			},
			"messages": []interface{}{}, // empty array
			"next":     []interface{}{},
			"step":     0,
		}

		checkpointBytes, _ := json.Marshal(checkpointData)

		// Set up mock expectations
		mock.ExpectQuery("SELECT checkpoint_data, checkpoint_ns FROM workflow_checkpoints").
			WithArgs("test-thread-789").
			WillReturnRows(sqlmock.NewRows([]string{"checkpoint_data", "checkpoint_ns"}).
				AddRow(checkpointBytes, "latest"))

		// Create gRPC server instance
		server := &MealPlannerAPIServer{}

		// Call GetCheckpoint
		resp, err := server.GetCheckpoint(context.Background(), &apipb.GetCheckpointRequest{
			ThreadId: "test-thread-789",
		})

		// Verify response
		if err != nil {
			t.Fatalf("GetCheckpoint failed: %v", err)
		}

		if !resp.Found {
			t.Fatal("Expected checkpoint to be found")
		}

		checkpoint := resp.Tuple.Checkpoint

		// Verify empty messages array
		if len(checkpoint.Messages) != 0 {
			t.Fatalf("Expected 0 messages, got %d", len(checkpoint.Messages))
		}
	})

	// Verify all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("There were unfulfilled expectations: %s", err)
	}
}