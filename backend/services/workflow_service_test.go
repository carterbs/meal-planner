package services

import (
	"database/sql"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/protobuf/encoding/protojson"

	apipb "mealplanner/generated/go"
	"mealplanner/models"
	"mealplanner/repositories/mocks"
	"mealplanner/testutil"
)

func TestWorkflowService_GetMealPlan(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		setupMocks    func(*mocks.MockWorkflowRepository)
		expectedPlan  *apipb.WeeklyMealPlan
		expectedError string
	}{
		{
			name:     "successful retrieval",
			threadID: "test-thread-123",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				state := &apipb.MealPlanningCheckpointState{
					MealPlan: testutil.NewAPIWeeklyMealPlanBuilder().Build(),
				}
				checkpoint := &apipb.AgentCheckpoint{State: state}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "test-thread-123").Return(checkpointData, "latest", nil)
			},
			expectedPlan: testutil.NewAPIWeeklyMealPlanBuilder().Build(),
		},
		{
			name:     "checkpoint not found",
			threadID: "nonexistent-thread",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "nonexistent-thread").Return(nil, "", sql.ErrNoRows)
			},
			expectedError: "failed to get workflow state: failed to get checkpoint: sql: no rows in result set",
		},
		{
			name:     "no meal plan in state",
			threadID: "empty-state-thread",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				state := &apipb.MealPlanningCheckpointState{
					MealPlan: nil,
				}
				checkpoint := &apipb.AgentCheckpoint{State: state}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "empty-state-thread").Return(checkpointData, "latest", nil)
			},
			expectedError: "no meal plan found in workflow state",
		},
		{
			name:     "database error",
			threadID: "error-thread",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "error-thread").Return(nil, "", fmt.Errorf("database error"))
			},
			expectedError: "failed to get workflow state: failed to get checkpoint: database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			plan, err := service.GetMealPlan(tt.threadID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, plan)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, plan)
				assert.Equal(t, tt.expectedPlan.Days[0].Meal.Name, plan.Days[0].Meal.Name)
			}
		})
	}
}

func TestWorkflowService_UpdateMealPlan(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		plan          *apipb.WeeklyMealPlan
		setupMocks    func(*mocks.MockWorkflowRepository, *mocks.MockMealPlanRepository)
		expectedError string
	}{
		{
			name:     "successful update",
			threadID: "test-thread-123",
			plan:     testutil.NewAPIWeeklyMealPlanBuilder().Build(),
			setupMocks: func(mockWorkflowRepo *mocks.MockWorkflowRepository, mockMealPlanRepo *mocks.MockMealPlanRepository) {
				// Mock for GetLatestMealPlan
				existingPlan := &models.MealPlanIdentifier{Version: 1}
				mockMealPlanRepo.On("GetLatestMealPlan", mock.Anything, "test-thread-123").Return(existingPlan, nil)

				// Mock for SaveMealPlan
				mockMealPlanRepo.On("SaveMealPlan", mock.Anything, "test-thread-123", 2, mock.Anything).Return(&models.MealPlanIdentifier{Version: 2}, nil)

				// Mock for GetWorkflowState
				state := &apipb.MealPlanningCheckpointState{
					MealPlan: testutil.NewAPIWeeklyMealPlanBuilder().Build(),
				}
				checkpoint := &apipb.AgentCheckpoint{State: state}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockWorkflowRepo.On("GetWorkflowCheckpoint", mock.Anything, "test-thread-123").Return(checkpointData, "latest", nil)

				// Mock for UpdateWorkflowCheckpoint
				mockWorkflowRepo.On("UpdateWorkflowCheckpoint", mock.Anything, "test-thread-123", mock.AnythingOfType("[]uint8")).Return(nil)
			},
		},
		{
			name:     "first version creation",
			threadID: "new-thread-456",
			plan:     testutil.NewAPIWeeklyMealPlanBuilder().Build(),
			setupMocks: func(mockWorkflowRepo *mocks.MockWorkflowRepository, mockMealPlanRepo *mocks.MockMealPlanRepository) {
				// Mock for GetLatestMealPlan (no existing plan)
				mockMealPlanRepo.On("GetLatestMealPlan", mock.Anything, "new-thread-456").Return(nil, sql.ErrNoRows)

				// Mock for SaveMealPlan
				mockMealPlanRepo.On("SaveMealPlan", mock.Anything, "new-thread-456", 1, mock.Anything).Return(&models.MealPlanIdentifier{Version: 1}, nil)

				// Mock for GetWorkflowState
				state := &apipb.MealPlanningCheckpointState{
					MealPlan: testutil.NewAPIWeeklyMealPlanBuilder().Build(),
				}
				checkpoint := &apipb.AgentCheckpoint{State: state}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockWorkflowRepo.On("GetWorkflowCheckpoint", mock.Anything, "new-thread-456").Return(checkpointData, "latest", nil)

				// Mock for UpdateWorkflowCheckpoint
				mockWorkflowRepo.On("UpdateWorkflowCheckpoint", mock.Anything, "new-thread-456", mock.AnythingOfType("[]uint8")).Return(nil)
			},
		},
		{
			name:     "get workflow state error",
			threadID: "error-thread",
			plan:     testutil.NewAPIWeeklyMealPlanBuilder().Build(),
			setupMocks: func(mockWorkflowRepo *mocks.MockWorkflowRepository, mockMealPlanRepo *mocks.MockMealPlanRepository) {
				// Mock for GetLatestMealPlan
				mockMealPlanRepo.On("GetLatestMealPlan", mock.Anything, "error-thread").Return(nil, sql.ErrNoRows)

				// Mock for SaveMealPlan
				mockMealPlanRepo.On("SaveMealPlan", mock.Anything, "error-thread", 1, mock.Anything).Return(&models.MealPlanIdentifier{Version: 1}, nil)

				// Mock for GetWorkflowState (error)
				mockWorkflowRepo.On("GetWorkflowCheckpoint", mock.Anything, "error-thread").Return(nil, "", fmt.Errorf("database error"))
			},
			expectedError: "failed to get workflow state: failed to get checkpoint: database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo, mockMealPlanRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			err := service.UpdateMealPlan(tt.threadID, tt.plan)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestWorkflowService_GetWorkflowState(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		setupMocks    func(*mocks.MockWorkflowRepository)
		expectedState *apipb.MealPlanningCheckpointState
		expectedError string
	}{
		{
			name:     "successful retrieval",
			threadID: "test-thread-123",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				state := &apipb.MealPlanningCheckpointState{
					ThreadId:    "test-thread-123",
					CurrentStep: "initial",
					MealPlan:    testutil.NewAPIWeeklyMealPlanBuilder().Build(),
				}
				checkpoint := &apipb.AgentCheckpoint{State: state}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "test-thread-123").Return(checkpointData, "latest", nil)
			},
			expectedState: &apipb.MealPlanningCheckpointState{
				ThreadId:    "test-thread-123",
				CurrentStep: "initial",
				MealPlan:    testutil.NewAPIWeeklyMealPlanBuilder().Build(),
			},
		},
		{
			name:     "checkpoint not found",
			threadID: "nonexistent-thread",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "nonexistent-thread").Return(nil, "", sql.ErrNoRows)
			},
			expectedError: "failed to get checkpoint: sql: no rows in result set",
		},
		{
			name:     "no checkpoint data",
			threadID: "nil-data-thread",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "nil-data-thread").Return(nil, "", nil)
			},
			expectedError: "no checkpoint found for thread nil-data-thread",
		},
		{
			name:     "invalid checkpoint data",
			threadID: "invalid-data-thread",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "invalid-data-thread").Return([]byte("invalid json"), "latest", nil)
			},
			expectedError: "failed to unmarshal checkpoint",
		},
		{
			name:     "checkpoint without state",
			threadID: "no-state-thread",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				checkpoint := &apipb.AgentCheckpoint{State: nil}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "no-state-thread").Return(checkpointData, "latest", nil)
			},
			expectedError: "checkpoint has no state for thread no-state-thread",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			state, err := service.GetWorkflowState(tt.threadID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, state)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, state)
				assert.Equal(t, tt.expectedState.ThreadId, state.ThreadId)
				assert.Equal(t, tt.expectedState.CurrentStep, state.CurrentStep)
			}
		})
	}
}

func TestWorkflowService_UpdateWorkflowState(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		state         *apipb.MealPlanningCheckpointState
		setupMocks    func(*mocks.MockWorkflowRepository)
		expectedError string
	}{
		{
			name:     "successful update",
			threadID: "test-thread-123",
			state: &apipb.MealPlanningCheckpointState{
				ThreadId:    "test-thread-123",
				CurrentStep: "updated",
				MealPlan:    testutil.NewAPIWeeklyMealPlanBuilder().Build(),
			},
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				// Mock for GetWorkflowCheckpoint (get existing)
				existingState := &apipb.MealPlanningCheckpointState{
					ThreadId:    "test-thread-123",
					CurrentStep: "initial",
				}
				checkpoint := &apipb.AgentCheckpoint{State: existingState}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "test-thread-123").Return(checkpointData, "latest", nil)

				// Mock for UpdateWorkflowCheckpoint
				mockRepo.On("UpdateWorkflowCheckpoint", mock.Anything, "test-thread-123", mock.AnythingOfType("[]uint8")).Return(nil)
			},
		},
		{
			name:     "get existing checkpoint error",
			threadID: "error-thread",
			state: &apipb.MealPlanningCheckpointState{
				ThreadId:    "error-thread",
				CurrentStep: "updated",
			},
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "error-thread").Return(nil, "", fmt.Errorf("database error"))
			},
			expectedError: "failed to get existing checkpoint: database error",
		},
		{
			name:     "no existing checkpoint",
			threadID: "no-checkpoint-thread",
			state: &apipb.MealPlanningCheckpointState{
				ThreadId:    "no-checkpoint-thread",
				CurrentStep: "updated",
			},
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "no-checkpoint-thread").Return(nil, "", nil)
			},
			expectedError: "no existing checkpoint found for thread no-checkpoint-thread",
		},
		{
			name:     "update checkpoint error",
			threadID: "update-error-thread",
			state: &apipb.MealPlanningCheckpointState{
				ThreadId:    "update-error-thread",
				CurrentStep: "updated",
			},
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				// Mock for GetWorkflowCheckpoint (get existing)
				existingState := &apipb.MealPlanningCheckpointState{
					ThreadId:    "update-error-thread",
					CurrentStep: "initial",
				}
				checkpoint := &apipb.AgentCheckpoint{State: existingState}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "update-error-thread").Return(checkpointData, "latest", nil)

				// Mock for UpdateWorkflowCheckpoint (error)
				mockRepo.On("UpdateWorkflowCheckpoint", mock.Anything, "update-error-thread", mock.AnythingOfType("[]uint8")).Return(fmt.Errorf("update error"))
			},
			expectedError: "failed to update checkpoint: update error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			err := service.UpdateWorkflowState(tt.threadID, tt.state)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestWorkflowService_GetWorkflowCheckpoint(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		setupMocks    func(*mocks.MockWorkflowRepository)
		expectedData  []byte
		expectedNS    string
		expectedError string
	}{
		{
			name:     "successful retrieval",
			threadID: "test-thread-123",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				checkpointData := []byte(`{"state": {"thread_id": "test-thread-123"}}`)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "test-thread-123").Return(checkpointData, "latest", nil)
			},
			expectedData: []byte(`{"state": {"thread_id": "test-thread-123"}}`),
			expectedNS:   "latest",
		},
		{
			name:     "database error",
			threadID: "error-thread",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "error-thread").Return(nil, "", fmt.Errorf("database error"))
			},
			expectedError: "failed to get workflow checkpoint for thread ID error-thread: database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			data, ns, err := service.GetWorkflowCheckpoint(tt.threadID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, data)
				assert.Empty(t, ns)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedData, data)
				assert.Equal(t, tt.expectedNS, ns)
			}
		})
	}
}

func TestWorkflowService_AddUserFeedback(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		from          string
		message       string
		timestamp     string
		setupMocks    func(*mocks.MockWorkflowRepository)
		expectedError string
	}{
		{
			name:      "successful feedback addition",
			threadID:  "test-thread-123",
			from:      "user",
			message:   "This looks good!",
			timestamp: "2023-01-01T12:00:00Z",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				// Mock for GetWorkflowState
				state := &apipb.MealPlanningCheckpointState{
					ThreadId:        "test-thread-123",
					FeedbackHistory: []*apipb.FeedbackEntryProto{},
				}
				checkpoint := &apipb.AgentCheckpoint{State: state}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "test-thread-123").Return(checkpointData, "latest", nil)

				// Mock for UpdateWorkflowCheckpoint
				mockRepo.On("UpdateWorkflowCheckpoint", mock.Anything, "test-thread-123", mock.AnythingOfType("[]uint8")).Return(nil)
			},
		},
		{
			name:      "invalid timestamp",
			threadID:  "test-thread-123",
			from:      "user",
			message:   "This looks good!",
			timestamp: "invalid-timestamp",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				// Mock for GetWorkflowState
				state := &apipb.MealPlanningCheckpointState{
					ThreadId:        "test-thread-123",
					FeedbackHistory: []*apipb.FeedbackEntryProto{},
				}
				checkpoint := &apipb.AgentCheckpoint{State: state}
				checkpointData, _ := protojson.Marshal(checkpoint)
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "test-thread-123").Return(checkpointData, "latest", nil)
			},
			expectedError: "failed to parse timestamp",
		},
		{
			name:      "get workflow state error",
			threadID:  "error-thread",
			from:      "user",
			message:   "This looks good!",
			timestamp: "2023-01-01T12:00:00Z",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("GetWorkflowCheckpoint", mock.Anything, "error-thread").Return(nil, "", fmt.Errorf("database error"))
			},
			expectedError: "failed to get checkpoint: database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			err := service.AddUserFeedback(tt.threadID, tt.from, tt.message, tt.timestamp)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestWorkflowService_AddMessage(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		sender        string
		message       string
		setupMocks    func(*mocks.MockWorkflowRepository)
		expectedError string
	}{
		{
			name:     "successful message addition",
			threadID: "test-thread-123",
			sender:   "user",
			message:  "Hello there!",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, "test-thread-123", "user", "Hello there!").Return(nil)
			},
		},
		{
			name:     "database error",
			threadID: "error-thread",
			sender:   "user",
			message:  "Hello there!",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, "error-thread", "user", "Hello there!").Return(fmt.Errorf("database error"))
			},
			expectedError: "failed to add message for thread ID error-thread: database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			msg, err := service.AddMessage(tt.threadID, tt.sender, tt.message)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, msg)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, msg)
				assert.Equal(t, tt.sender, msg.Sender)
				assert.Equal(t, tt.message, msg.Text)
			}
		})
	}
}

func TestWorkflowService_UpdateWorkflowCheckpoint(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		data          []byte
		setupMocks    func(*mocks.MockWorkflowRepository)
		expectedError string
	}{
		{
			name:     "successful update",
			threadID: "test-thread-123",
			data:     []byte(`{"state": {"thread_id": "test-thread-123"}}`),
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("UpdateWorkflowCheckpoint", mock.Anything, "test-thread-123", []byte(`{"state": {"thread_id": "test-thread-123"}}`)).Return(nil)
			},
		},
		{
			name:     "database error",
			threadID: "error-thread",
			data:     []byte(`{"state": {"thread_id": "error-thread"}}`),
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("UpdateWorkflowCheckpoint", mock.Anything, "error-thread", []byte(`{"state": {"thread_id": "error-thread"}}`)).Return(fmt.Errorf("database error"))
			},
			expectedError: "failed to update workflow checkpoint for thread ID error-thread: database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			err := service.UpdateWorkflowCheckpoint(tt.threadID, tt.data)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestWorkflowService_ListWorkflows(t *testing.T) {
	tests := []struct {
		name             string
		limit            int
		setupMocks       func(*mocks.MockWorkflowRepository)
		expectedStatuses []models.WorkflowStatus
		expectedError    string
	}{
		{
			name:  "successful list",
			limit: 10,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				statuses := []models.WorkflowStatus{
					{
						ThreadID:     "thread-1",
						WorkflowType: "meal_planning",
						CurrentStep:  "initial",
						Participants: []string{"user1"},
					},
					{
						ThreadID:     "thread-2",
						WorkflowType: "meal_planning",
						CurrentStep:  "complete",
						Participants: []string{"user2"},
					},
				}
				mockRepo.On("ListWorkflows", mock.Anything, 10).Return(statuses, nil)
			},
			expectedStatuses: []models.WorkflowStatus{
				{
					ThreadID:     "thread-1",
					WorkflowType: "meal_planning",
					CurrentStep:  "initial",
					Participants: []string{"user1"},
				},
				{
					ThreadID:     "thread-2",
					WorkflowType: "meal_planning",
					CurrentStep:  "complete",
					Participants: []string{"user2"},
				},
			},
		},
		{
			name:  "database error",
			limit: 10,
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("ListWorkflows", mock.Anything, 10).Return(nil, fmt.Errorf("database error"))
			},
			expectedError: "database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			statuses, err := service.ListWorkflows(tt.limit)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, statuses)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedStatuses, statuses)
			}
		})
	}
}

func TestWorkflowService_AddAgentMessage(t *testing.T) {
	tests := []struct {
		name      string
		threadID  string
		text      string
		timestamp string
	}{
		{
			name:      "agent message addition (disabled)",
			threadID:  "test-thread-123",
			text:      "Agent response",
			timestamp: "2023-01-01T12:00:00Z",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			// This function is currently disabled and returns nil
			err := service.AddAgentMessage(tt.threadID, tt.text, tt.timestamp)
			assert.NoError(t, err)
		})
	}
}

func TestWorkflowService_UpdateWorkflowCheckpointWithMessage(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		sender        string
		message       string
		setupMocks    func(*mocks.MockWorkflowRepository)
		expectedError string
	}{
		{
			name:     "successful message addition",
			threadID: "test-thread-123",
			sender:   "user",
			message:  "Hello there!",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, "test-thread-123", "user", "Hello there!").Return(nil)
			},
		},
		{
			name:     "database error",
			threadID: "error-thread",
			sender:   "user",
			message:  "Hello there!",
			setupMocks: func(mockRepo *mocks.MockWorkflowRepository) {
				mockRepo.On("AddMessage", mock.Anything, "error-thread", "user", "Hello there!").Return(fmt.Errorf("database error"))
			},
			expectedError: "failed to add message for thread ID error-thread: database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWorkflowRepo := mocks.NewMockWorkflowRepository(t)
			mockMealPlanRepo := mocks.NewMockMealPlanRepository(t)
			tt.setupMocks(mockWorkflowRepo)

			service := NewWorkflowService(mockWorkflowRepo, mockMealPlanRepo)

			err := service.UpdateWorkflowCheckpointWithMessage(tt.threadID, tt.sender, tt.message)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}