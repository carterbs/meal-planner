package main

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apipb "mealplanner/generated/go"
	"mealplanner/server"
	"mealplanner/services"
)

func TestAddMessage(t *testing.T) {
	// Store original DB for restoration
	originalDB := server.DB
	originalServices := server.Services

	t.Cleanup(func() {
		server.DB = originalDB
		server.Services = originalServices
	})

	// Create mock database
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	server.DB = db
	server.Services = services.NewServiceContainer(db)

	grpcServer := &MealPlannerAPIServer{}

	t.Run("successful message addition", func(t *testing.T) {
		// Set up mock expectations for successful message addition
		mock.ExpectExec("INSERT INTO messages").
			WithArgs("test-thread-123", "user", "Hello, world!").
			WillReturnResult(sqlmock.NewResult(1, 1))

		req := &apipb.AddMessageRequest{
			ThreadId: "test-thread-123",
			Sender:   "user",
			Message:  "Hello, world!",
		}

		resp, err := grpcServer.AddMessage(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, resp)
		assert.Equal(t, "Message added successfully", resp.Message)
	})

	t.Run("missing thread_id", func(t *testing.T) {
		req := &apipb.AddMessageRequest{
			Sender:  "user",
			Message: "Hello, world!",
		}

		resp, err := grpcServer.AddMessage(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "threadId required")
	})

	t.Run("missing sender", func(t *testing.T) {
		req := &apipb.AddMessageRequest{
			ThreadId: "test-thread-123",
			Message:  "Hello, world!",
		}

		resp, err := grpcServer.AddMessage(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "sender required")
	})

	t.Run("missing message", func(t *testing.T) {
		req := &apipb.AddMessageRequest{
			ThreadId: "test-thread-123",
			Sender:   "user",
		}

		resp, err := grpcServer.AddMessage(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "message required")
	})

	t.Run("database error", func(t *testing.T) {
		// Set up mock expectations for database error
		mock.ExpectExec("INSERT INTO messages").
			WithArgs("test-thread-123", "user", "Hello, world!").
			WillReturnError(assert.AnError)

		req := &apipb.AddMessageRequest{
			ThreadId: "test-thread-123",
			Sender:   "user",
			Message:  "Hello, world!",
		}

		resp, err := grpcServer.AddMessage(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "failed to add message")
	})

	// Verify all expectations were met
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestGetMessages(t *testing.T) {
	// Store original DB for restoration
	originalDB := server.DB
	originalServices := server.Services

	t.Cleanup(func() {
		server.DB = originalDB
		server.Services = originalServices
	})

	// Create mock database
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	server.DB = db
	server.Services = services.NewServiceContainer(db)

	grpcServer := &MealPlannerAPIServer{}

	t.Run("successful message retrieval", func(t *testing.T) {
		// Set up mock expectations for successful message retrieval
		rows := sqlmock.NewRows([]string{"sender", "content", "created_at"}).
			AddRow("user", "Hello, world!", time.Now()).
			AddRow("agent", "Hi there!", time.Now().Add(time.Minute))

		mock.ExpectQuery("SELECT sender, content, created_at FROM messages").
			WithArgs("test-thread-123").
			WillReturnRows(rows)

		req := &apipb.GetMessagesRequest{
			ThreadId: "test-thread-123",
		}

		resp, err := grpcServer.GetMessages(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, resp)
		assert.Len(t, resp.Messages, 2)
		
		assert.Equal(t, "test-thread-123", resp.Messages[0].ThreadId)
		assert.Equal(t, "user", resp.Messages[0].Sender)
		assert.Equal(t, "Hello, world!", resp.Messages[0].Content)
		assert.NotEmpty(t, resp.Messages[0].CreatedAt)
		
		assert.Equal(t, "test-thread-123", resp.Messages[1].ThreadId)
		assert.Equal(t, "agent", resp.Messages[1].Sender)
		assert.Equal(t, "Hi there!", resp.Messages[1].Content)
		assert.NotEmpty(t, resp.Messages[1].CreatedAt)
	})

	t.Run("empty message list", func(t *testing.T) {
		// Set up mock expectations for empty result
		rows := sqlmock.NewRows([]string{"sender", "content", "created_at"})

		mock.ExpectQuery("SELECT sender, content, created_at FROM messages").
			WithArgs("test-thread-456").
			WillReturnRows(rows)

		req := &apipb.GetMessagesRequest{
			ThreadId: "test-thread-456",
		}

		resp, err := grpcServer.GetMessages(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, resp)
		assert.Len(t, resp.Messages, 0)
	})

	t.Run("missing thread_id", func(t *testing.T) {
		req := &apipb.GetMessagesRequest{}

		resp, err := grpcServer.GetMessages(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "threadId required")
	})

	t.Run("database error", func(t *testing.T) {
		// Set up mock expectations for database error
		mock.ExpectQuery("SELECT sender, content, created_at FROM messages").
			WithArgs("test-thread-123").
			WillReturnError(assert.AnError)

		req := &apipb.GetMessagesRequest{
			ThreadId: "test-thread-123",
		}

		resp, err := grpcServer.GetMessages(context.Background(), req)

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Contains(t, err.Error(), "failed to get messages")
	})

	// Verify all expectations were met
	require.NoError(t, mock.ExpectationsWereMet())
}