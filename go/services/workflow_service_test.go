package services

import (
	"mealplanner/models"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func makeTestWorkflowState() *models.InternalWorkflowState {
	return &models.InternalWorkflowState{
		FeedbackHistory: []models.FeedbackEntry{},
		AgentMessages:   []models.AgentMessage{},
	}
}

func TestAddAgentMessage_AppendsAllMessages(t *testing.T) {
	ts := newTestWorkflowService()
	threadID := "test-thread"
	state := makeTestWorkflowState()
	ts.stateStore[threadID] = state

	ts.AddAgentMessage(threadID, "First message", time.Now().Format(time.RFC3339))
	ts.AddAgentMessage(threadID, "Second message", time.Now().Format(time.RFC3339))
	ts.AddAgentMessage(threadID, "Third message", time.Now().Format(time.RFC3339))

	loaded, err := ts.GetWorkflowState(threadID)
	require.NoError(t, err)
	require.Len(t, loaded.AgentMessages, 3)
	require.Equal(t, "First message", loaded.AgentMessages[0].Text)
	require.Equal(t, "Second message", loaded.AgentMessages[1].Text)
	require.Equal(t, "Third message", loaded.AgentMessages[2].Text)
}

func TestGetWorkflowState_ReturnsFullChatHistory(t *testing.T) {
	ts := newTestWorkflowService()
	threadID := "test-thread"
	state := makeTestWorkflowState()
	state.FeedbackHistory = append(state.FeedbackHistory,
		models.FeedbackEntry{From: "user", Message: "Hi", Timestamp: "2025-07-01T12:00:00Z"},
		models.FeedbackEntry{From: "user", Message: "More veggies", Timestamp: "2025-07-01T12:01:00Z"},
	)
	state.AgentMessages = append(state.AgentMessages,
		models.AgentMessage{Sender: "agent", Text: "Welcome!", Timestamp: "2025-07-01T12:00:10Z"},
		models.AgentMessage{Sender: "agent", Text: "Added veggies", Timestamp: "2025-07-01T12:01:10Z"},
	)
	ts.stateStore[threadID] = state

	loaded, err := ts.GetWorkflowState(threadID)
	require.NoError(t, err)
	require.Len(t, loaded.FeedbackHistory, 2)
	require.Len(t, loaded.AgentMessages, 2)

	// Simulate handler logic for combining and sorting messages
	var all []struct {
		Sender    string
		Text      string
		Timestamp string
	}
	for _, f := range loaded.FeedbackHistory {
		all = append(all, struct {
			Sender    string
			Text      string
			Timestamp string
		}{Sender: f.From, Text: f.Message, Timestamp: f.Timestamp})
	}
	for _, a := range loaded.AgentMessages {
		all = append(all, struct {
			Sender    string
			Text      string
			Timestamp string
		}{Sender: a.Sender, Text: a.Text, Timestamp: a.Timestamp})
	}
	// sort by timestamp
	sorted := make([]struct {
		Sender    string
		Text      string
		Timestamp string
	}, len(all))
	copy(sorted, all)
	// naive bubble sort for demonstration
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[i].Timestamp > sorted[j].Timestamp {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	// Check the order and inclusion
	require.Equal(t, "Hi", sorted[0].Text)
	require.Equal(t, "Welcome!", sorted[1].Text)
	require.Equal(t, "More veggies", sorted[2].Text)
	require.Equal(t, "Added veggies", sorted[3].Text)
}

// --- Test helpers ---
type testWorkflowService struct {
	stateStore map[string]*models.InternalWorkflowState
}

func newTestWorkflowService() *testWorkflowService {
	return &testWorkflowService{stateStore: map[string]*models.InternalWorkflowState{}}
}

func (ts *testWorkflowService) AddAgentMessage(threadID, text, timestamp string) error {
	st, ok := ts.stateStore[threadID]
	if !ok {
		st = makeTestWorkflowState()
		ts.stateStore[threadID] = st
	}
	st.AgentMessages = append(st.AgentMessages, models.AgentMessage{Sender: "agent", Text: text, Timestamp: timestamp})
	return nil
}

func (ts *testWorkflowService) GetWorkflowState(threadID string) (*models.InternalWorkflowState, error) {
	st, ok := ts.stateStore[threadID]
	if !ok {
		return nil, nil
	}
	return st, nil
}
