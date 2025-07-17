
package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"mealplanner/server"
	"mealplanner/services"
)

func TestHTTPMessageEndpoints(t *testing.T) {
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

	// Create HTTP test server with API gateway routes
	r := chi.NewRouter()
	
	// Mock gateway for testing
	gateway := &MockGateway{}
	r.Get("/api/workflows/{threadId}/messages", gateway.getMessages)
	r.Post("/api/workflows/{threadId}/messages", gateway.addMessage)

	server := httptest.NewServer(r)
	defer server.Close()

	t.Run("POST /api/workflows/{threadId}/messages", func(t *testing.T) {
		// Set up mock expectations
		mock.ExpectExec("INSERT INTO messages").
			WithArgs("test-thread-123", "user", "Hello via HTTP!").
			WillReturnResult(sqlmock.NewResult(1, 1))

		// Create request body
		reqBody := map[string]string{
			"sender":  "user",
			"message": "Hello via HTTP!",
		}
		body, _ := json.Marshal(reqBody)

		// Make HTTP request
		resp, err := http.Post(
			server.URL+"/api/workflows/test-thread-123/messages",
			"application/json",
			bytes.NewBuffer(body),
		)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify response
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)
		
		assert.Equal(t, "Message added successfully", response["message"])
	})

	t.Run("GET /api/workflows/{threadId}/messages", func(t *testing.T) {
		// Set up mock expectations for successful message retrieval
		time1, _ := time.Parse(time.RFC3339, "2023-01-01T12:00:00Z")
		rows := sqlmock.NewRows([]string{"sender", "content", "created_at"}).
			AddRow("user", "Hello via HTTP!", time1).
			AddRow("agent", "Hi there from HTTP!", time1.Add(1*time.Minute))

		mock.ExpectQuery("SELECT sender, content, created_at FROM messages").
			WithArgs("test-thread-456").
			WillReturnRows(rows)

		// Make HTTP request
		resp, err := http.Get(server.URL + "/api/workflows/test-thread-456/messages")
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify response
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		messages, ok := response["messages"].([]interface{})
		require.True(t, ok)
		assert.Len(t, messages, 2)

		// Check first message
		msg1 := messages[0].(map[string]interface{})
		assert.Equal(t, "test-thread-456", msg1["threadId"])
		assert.Equal(t, "user", msg1["sender"])
		assert.Equal(t, "Hello via HTTP!", msg1["content"])
		assert.Equal(t, "2023-01-01T12:00:00Z", msg1["createdAt"])

		// Check second message
		msg2 := messages[1].(map[string]interface{})
		assert.Equal(t, "test-thread-456", msg2["threadId"])
		assert.Equal(t, "agent", msg2["sender"])
		assert.Equal(t, "Hi there from HTTP!", msg2["content"])
		assert.Equal(t, "2023-01-01T12:01:00Z", msg2["createdAt"])
	})

	t.Run("POST with invalid JSON", func(t *testing.T) {
		// Make HTTP request with invalid JSON
		resp, err := http.Post(
			server.URL+"/api/workflows/test-thread-123/messages",
			"application/json",
			bytes.NewBuffer([]byte("invalid json")),
		)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify error response
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("POST with missing fields", func(t *testing.T) {
		// Expect Exec but return error due to validation or database failure
		mock.ExpectExec("INSERT INTO messages").
			WithArgs("test-thread-123", "", "Hello via HTTP!").
			WillReturnError(assert.AnError)

		// Create request body with missing sender
		reqBody := map[string]string{
			"message": "Hello via HTTP!",
		}
		body, _ := json.Marshal(reqBody)

		// Make HTTP request
		resp, err := http.Post(
			server.URL+"/api/workflows/test-thread-123/messages",
			"application/json",
			bytes.NewBuffer(body),
		)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify error response
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	// Verify all expectations were met
	require.NoError(t, mock.ExpectationsWereMet())
}

// MockGateway simulates the API Gateway handlers for testing
type MockGateway struct{}

func (g *MockGateway) addMessage(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")

	var reqBody struct {
		Sender  string `json:"sender"`
		Message string `json:"message"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Call the service directly (simulating gRPC call)
	_, err := server.Services.WorkflowService.AddMessage(threadId, reqBody.Sender, reqBody.Message)
	if err != nil {
		http.Error(w, "Failed to add message: "+err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"message": "Message added successfully",
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (g *MockGateway) getMessages(w http.ResponseWriter, r *http.Request) {
	threadId := chi.URLParam(r, "threadId")
	if threadId == "" {
		http.Error(w, "threadId is required", http.StatusBadRequest)
		return
	}

	// Call the service directly (simulating gRPC call)
	messages, err := server.Services.MessageService.GetMessagesWithTimestamps(threadId)
	if err != nil {
		http.Error(w, "Failed to get messages: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Convert to API response format
	responseMessages := make([]map[string]interface{}, len(messages))
	for i, msg := range messages {
		responseMessages[i] = map[string]interface{}{
			"threadId":  msg["thread_id"],
			"sender":    msg["sender"],
			"content":   msg["content"],
			"createdAt": msg["created_at"],
		}
	}

	response := map[string]interface{}{
		"messages": responseMessages,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}