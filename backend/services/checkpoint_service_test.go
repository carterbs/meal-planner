package services

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"mealplanner/repositories"
	"mealplanner/repositories/mocks"
	"mealplanner/testutil"
)

func TestCheckpointService_GetCheckpoint(t *testing.T) {
	tests := []struct {
		name           string
		threadID       string
		ns             string
		setupMocks     func(*mocks.MockCheckpointRepository)
		expectedData   []byte
		expectedMeta   []byte
		expectedFound  bool
		expectedErr    string
	}{
		{
			name:     "successful retrieval with namespace",
			threadID: testutil.TestThreadID,
			ns:       testutil.TestNamespace,
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				expectedData := []byte(`{"step":"test","data":"value"}`)
				expectedMeta := []byte(`{"version":"1.0"}`)
				repo.On("GetCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace).Return(expectedData, expectedMeta, true, nil)
			},
			expectedData:  []byte(`{"step":"test","data":"value"}`),
			expectedMeta:  []byte(`{"version":"1.0"}`),
			expectedFound: true,
			expectedErr:   "",
		},
		{
			name:     "successful retrieval without namespace (latest)",
			threadID: testutil.TestThreadID,
			ns:       "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				expectedData := []byte(`{"step":"latest","data":"value"}`)
				expectedMeta := []byte(`{"version":"2.0"}`)
				repo.On("GetCheckpoint", mock.Anything, testutil.TestThreadID, "").Return(expectedData, expectedMeta, true, nil)
			},
			expectedData:  []byte(`{"step":"latest","data":"value"}`),
			expectedMeta:  []byte(`{"version":"2.0"}`),
			expectedFound: true,
			expectedErr:   "",
		},
		{
			name:     "checkpoint not found",
			threadID: testutil.TestThreadID,
			ns:       testutil.TestNamespace,
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("GetCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace).Return([]byte(nil), []byte(nil), false, nil)
			},
			expectedData:  nil,
			expectedMeta:  nil,
			expectedFound: false,
			expectedErr:   "",
		},
		{
			name:     "database error",
			threadID: testutil.TestThreadID,
			ns:       testutil.TestNamespace,
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("GetCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace).Return([]byte(nil), []byte(nil), false, testutil.ErrTestDatabase)
			},
			expectedData:  nil,
			expectedMeta:  nil,
			expectedFound: false,
			expectedErr:   "test database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			repo := new(mocks.MockCheckpointRepository)
			tt.setupMocks(repo)

			service := NewCheckpointService(repo)

			// Execute
			data, meta, found, err := service.GetCheckpoint(tt.threadID, tt.ns)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}

			assert.Equal(t, tt.expectedData, data)
			assert.Equal(t, tt.expectedMeta, meta)
			assert.Equal(t, tt.expectedFound, found)

			repo.AssertExpectations(t)
		})
	}
}

func TestCheckpointService_PutCheckpoint(t *testing.T) {
	tests := []struct {
		name         string
		threadID     string
		ns           string
		workflowType string
		checkpoint   []byte
		metadata     []byte
		setupMocks   func(*mocks.MockCheckpointRepository)
		expectedErr  string
	}{
		{
			name:         "successful checkpoint storage",
			threadID:     testutil.TestThreadID,
			ns:           testutil.TestNamespace,
			workflowType: testutil.TestWorkflowType,
			checkpoint:   []byte(`{"step":"test","data":"value"}`),
			metadata:     []byte(`{"version":"1.0"}`),
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace, testutil.TestWorkflowType, []byte(`{"step":"test","data":"value"}`), []byte(`{"version":"1.0"}`)).Return(nil)
			},
			expectedErr: "",
		},
		{
			name:         "successful checkpoint update",
			threadID:     testutil.TestThreadID,
			ns:           "latest",
			workflowType: testutil.TestWorkflowType,
			checkpoint:   []byte(`{"step":"updated","data":"new_value"}`),
			metadata:     []byte(`{"version":"2.0"}`),
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, testutil.TestThreadID, "latest", testutil.TestWorkflowType, []byte(`{"step":"updated","data":"new_value"}`), []byte(`{"version":"2.0"}`)).Return(nil)
			},
			expectedErr: "",
		},
		{
			name:         "database error during storage",
			threadID:     testutil.TestThreadID,
			ns:           testutil.TestNamespace,
			workflowType: testutil.TestWorkflowType,
			checkpoint:   []byte(`{"step":"test","data":"value"}`),
			metadata:     []byte(`{"version":"1.0"}`),
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace, testutil.TestWorkflowType, []byte(`{"step":"test","data":"value"}`), []byte(`{"version":"1.0"}`)).Return(testutil.ErrTestDatabase)
			},
			expectedErr: "test database error",
		},
		{
			name:         "empty checkpoint data",
			threadID:     testutil.TestThreadID,
			ns:           testutil.TestNamespace,
			workflowType: testutil.TestWorkflowType,
			checkpoint:   []byte{},
			metadata:     []byte{},
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace, testutil.TestWorkflowType, []byte{}, []byte{}).Return(nil)
			},
			expectedErr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			repo := new(mocks.MockCheckpointRepository)
			tt.setupMocks(repo)

			service := NewCheckpointService(repo)

			// Execute
			err := service.PutCheckpoint(tt.threadID, tt.ns, tt.workflowType, tt.checkpoint, tt.metadata)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestCheckpointService_ListCheckpoints(t *testing.T) {
	tests := []struct {
		name              string
		limit             int
		before            string
		setupMocks        func(*mocks.MockCheckpointRepository)
		expectedCount     int
		expectedFirstID   string
		expectedErr       string
	}{
		{
			name:   "successful listing with limit",
			limit:  5,
			before: "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				expectedRecords := []repositories.CheckpointRecord{
					{ThreadID: "thread-1", CheckpointNS: "latest", Checkpoint: []byte(`{"step":"1"}`), Metadata: []byte(`{"v":"1"}`)},
					{ThreadID: "thread-2", CheckpointNS: "latest", Checkpoint: []byte(`{"step":"2"}`), Metadata: []byte(`{"v":"2"}`)},
					{ThreadID: "thread-3", CheckpointNS: "backup", Checkpoint: []byte(`{"step":"3"}`), Metadata: []byte(`{"v":"3"}`)},
				}
				repo.On("ListCheckpoints", mock.Anything, 5, "").Return(expectedRecords, nil)
			},
			expectedCount:   3,
			expectedFirstID: "thread-1",
			expectedErr:     "",
		},
		{
			name:   "successful listing with pagination",
			limit:  10,
			before: "thread-5",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				expectedRecords := []repositories.CheckpointRecord{
					{ThreadID: "thread-6", CheckpointNS: "latest", Checkpoint: []byte(`{"step":"6"}`), Metadata: []byte(`{"v":"6"}`)},
					{ThreadID: "thread-7", CheckpointNS: "latest", Checkpoint: []byte(`{"step":"7"}`), Metadata: []byte(`{"v":"7"}`)},
				}
				repo.On("ListCheckpoints", mock.Anything, 10, "thread-5").Return(expectedRecords, nil)
			},
			expectedCount:   2,
			expectedFirstID: "thread-6",
			expectedErr:     "",
		},
		{
			name:   "empty result set",
			limit:  5,
			before: "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("ListCheckpoints", mock.Anything, 5, "").Return([]repositories.CheckpointRecord{}, nil)
			},
			expectedCount:   0,
			expectedFirstID: "",
			expectedErr:     "",
		},
		{
			name:   "database error",
			limit:  5,
			before: "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("ListCheckpoints", mock.Anything, 5, "").Return([]repositories.CheckpointRecord(nil), testutil.ErrTestDatabase)
			},
			expectedCount:   0,
			expectedFirstID: "",
			expectedErr:     "test database error",
		},
		{
			name:   "large limit",
			limit:  1000,
			before: "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				// Simulate large result set
				var records []repositories.CheckpointRecord
				for i := 1; i <= 100; i++ {
					records = append(records, repositories.CheckpointRecord{
						ThreadID:     fmt.Sprintf("thread-%d", i),
						CheckpointNS: "latest",
						Checkpoint:   []byte(fmt.Sprintf(`{"step":"%d"}`, i)),
						Metadata:     []byte(fmt.Sprintf(`{"v":"%d"}`, i)),
					})
				}
				repo.On("ListCheckpoints", mock.Anything, 1000, "").Return(records, nil)
			},
			expectedCount:   100,
			expectedFirstID: "thread-1",
			expectedErr:     "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			repo := new(mocks.MockCheckpointRepository)
			tt.setupMocks(repo)

			service := NewCheckpointService(repo)

			// Execute
			records, err := service.ListCheckpoints(tt.limit, tt.before)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, records)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, records)
				assert.Equal(t, tt.expectedCount, len(records))
				if tt.expectedCount > 0 {
					assert.Equal(t, tt.expectedFirstID, records[0].ThreadID)
				}
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestCheckpointService_EdgeCases(t *testing.T) {
	tests := []struct {
		name        string
		testFunc    func(CheckpointService, *mocks.MockCheckpointRepository)
		expectedErr string
	}{
		{
			name: "empty thread ID in GetCheckpoint",
			testFunc: func(service CheckpointService, repo *mocks.MockCheckpointRepository) {
				repo.On("GetCheckpoint", mock.Anything, "", "test").Return([]byte(nil), []byte(nil), false, nil)
				_, _, _, err := service.GetCheckpoint("", "test")
				assert.NoError(t, err) // Should not error, just return not found
			},
		},
		{
			name: "empty thread ID in PutCheckpoint",
			testFunc: func(service CheckpointService, repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, "", "test", "meal_planning", []byte(`{}`), []byte(`{}`)).Return(nil)
				err := service.PutCheckpoint("", "test", "meal_planning", []byte(`{}`), []byte(`{}`))
				assert.NoError(t, err) // Repository should handle validation
			},
		},
		{
			name: "zero limit in ListCheckpoints",
			testFunc: func(service CheckpointService, repo *mocks.MockCheckpointRepository) {
				repo.On("ListCheckpoints", mock.Anything, 0, "").Return([]repositories.CheckpointRecord{}, nil)
				records, err := service.ListCheckpoints(0, "")
				assert.NoError(t, err)
				assert.Empty(t, records)
			},
		},
		{
			name: "negative limit in ListCheckpoints",
			testFunc: func(service CheckpointService, repo *mocks.MockCheckpointRepository) {
				repo.On("ListCheckpoints", mock.Anything, -1, "").Return([]repositories.CheckpointRecord{}, nil)
				records, err := service.ListCheckpoints(-1, "")
				assert.NoError(t, err)
				assert.Empty(t, records)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			repo := new(mocks.MockCheckpointRepository)
			service := NewCheckpointService(repo)

			// Execute
			tt.testFunc(service, repo)

			repo.AssertExpectations(t)
		})
	}
}

func TestCheckpointService_PutCheckpoint_LargeData(t *testing.T) {
	tests := []struct {
		name          string
		threadID      string
		checkpointNS  string
		workflowType  string
		checkpoint    []byte
		metadata      []byte
		setupMocks    func(*mocks.MockCheckpointRepository)
		expectedErr   string
	}{
		{
			name:         "large checkpoint data",
			threadID:     testutil.TestThreadID,
			checkpointNS: testutil.TestNamespace,
			workflowType: testutil.TestWorkflowType,
			checkpoint:   make([]byte, 1024*1024), // 1MB of data
			metadata:     []byte(`{"size":"large"}`),
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace, testutil.TestWorkflowType, mock.MatchedBy(func(data []byte) bool {
					return len(data) == 1024*1024
				}), []byte(`{"size":"large"}`)).Return(nil)
			},
		},
		{
			name:         "empty checkpoint data",
			threadID:     testutil.TestThreadID,
			checkpointNS: testutil.TestNamespace,
			workflowType: testutil.TestWorkflowType,
			checkpoint:   []byte{},
			metadata:     []byte(`{}`),
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace, testutil.TestWorkflowType, []byte{}, []byte(`{}`)).Return(nil)
			},
		},
		{
			name:         "nil metadata",
			threadID:     testutil.TestThreadID,
			checkpointNS: testutil.TestNamespace,
			workflowType: testutil.TestWorkflowType,
			checkpoint:   []byte(`{"test": "data"}`),
			metadata:     nil,
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace, testutil.TestWorkflowType, []byte(`{"test": "data"}`), []byte(nil)).Return(nil)
			},
		},
		{
			name:         "special characters in data",
			threadID:     "thread-with-special-chars-🚀",
			checkpointNS: "namespace-with-emoji-🎯",
			workflowType: testutil.TestWorkflowType,
			checkpoint:   []byte(`{"unicode": "test-🚀-data", "special": "chars!@#$%^&*()[]{}|;:,.<>?"}`),
			metadata:     []byte(`{"encoding": "utf-8"}`),
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, "thread-with-special-chars-🚀", "namespace-with-emoji-🎯", testutil.TestWorkflowType, []byte(`{"unicode": "test-🚀-data", "special": "chars!@#$%^&*()[]{}|;:,.<>?"}`), []byte(`{"encoding": "utf-8"}`)).Return(nil)
			},
		},
		{
			name:         "database constraint error",
			threadID:     testutil.TestThreadID,
			checkpointNS: testutil.TestNamespace,
			workflowType: testutil.TestWorkflowType,
			checkpoint:   []byte(`{"test": "data"}`),
			metadata:     []byte(`{"meta": "data"}`),
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("PutCheckpoint", mock.Anything, testutil.TestThreadID, testutil.TestNamespace, testutil.TestWorkflowType, []byte(`{"test": "data"}`), []byte(`{"meta": "data"}`)).Return(fmt.Errorf("database constraint violation"))
			},
			expectedErr: "database constraint violation",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			repo := new(mocks.MockCheckpointRepository)
			tt.setupMocks(repo)

			service := NewCheckpointService(repo)

			// Execute
			err := service.PutCheckpoint(tt.threadID, tt.checkpointNS, tt.workflowType, tt.checkpoint, tt.metadata)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestCheckpointService_ListCheckpoints_ComplexScenarios(t *testing.T) {
	tests := []struct {
		name              string
		limit             int
		before            string
		setupMocks        func(*mocks.MockCheckpointRepository)
		expectedCount     int
		expectedErr       string
		validateResults   func(t *testing.T, records []repositories.CheckpointRecord)
	}{
		{
			name:   "pagination with mixed workflow types",
			limit:  3,
			before: "thread-10",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				records := []repositories.CheckpointRecord{
					{ThreadID: "thread-11", CheckpointNS: "latest", Checkpoint: []byte(`{"workflow":"meal_planning"}`), Metadata: []byte(`{"type":"meal_planning"}`)},
					{ThreadID: "thread-12", CheckpointNS: "backup", Checkpoint: []byte(`{"workflow":"shopping"}`), Metadata: []byte(`{"type":"shopping"}`)},
					{ThreadID: "thread-13", CheckpointNS: "latest", Checkpoint: []byte(`{"workflow":"meal_planning"}`), Metadata: []byte(`{"type":"meal_planning"}`)},
				}
				repo.On("ListCheckpoints", mock.Anything, 3, "thread-10").Return(records, nil)
			},
			expectedCount: 3,
			validateResults: func(t *testing.T, records []repositories.CheckpointRecord) {
				assert.Equal(t, "thread-11", records[0].ThreadID)
				assert.Equal(t, "thread-12", records[1].ThreadID)
				assert.Equal(t, "thread-13", records[2].ThreadID)
				assert.Equal(t, "latest", records[0].CheckpointNS)
				assert.Equal(t, "backup", records[1].CheckpointNS)
			},
		},
		{
			name:   "very large checkpoint data in results",
			limit:  1,
			before: "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				largeData := make([]byte, 1024*1024) // 1MB
				for i := range largeData {
					largeData[i] = byte(i % 256)
				}
				records := []repositories.CheckpointRecord{
					{ThreadID: "thread-large", CheckpointNS: "latest", Checkpoint: largeData, Metadata: []byte(`{"size":"large"}`)},
				}
				repo.On("ListCheckpoints", mock.Anything, 1, "").Return(records, nil)
			},
			expectedCount: 1,
			validateResults: func(t *testing.T, records []repositories.CheckpointRecord) {
				assert.Equal(t, "thread-large", records[0].ThreadID)
				assert.Equal(t, 1024*1024, len(records[0].Checkpoint))
				assert.Equal(t, []byte(`{"size":"large"}`), records[0].Metadata)
			},
		},
		{
			name:   "unicode and special characters in thread IDs",
			limit:  2,
			before: "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				records := []repositories.CheckpointRecord{
					{ThreadID: "thread-🚀-emoji", CheckpointNS: "latest", Checkpoint: []byte(`{"unicode":"test"}`), Metadata: []byte(`{"encoding":"utf-8"}`)},
					{ThreadID: "thread-with-special!@#$%", CheckpointNS: "backup", Checkpoint: []byte(`{"special":"chars"}`), Metadata: []byte(`{"type":"special"}`)},
				}
				repo.On("ListCheckpoints", mock.Anything, 2, "").Return(records, nil)
			},
			expectedCount: 2,
			validateResults: func(t *testing.T, records []repositories.CheckpointRecord) {
				assert.Equal(t, "thread-🚀-emoji", records[0].ThreadID)
				assert.Equal(t, "thread-with-special!@#$%", records[1].ThreadID)
			},
		},
		{
			name:   "empty checkpoint data in results",
			limit:  1,
			before: "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				records := []repositories.CheckpointRecord{
					{ThreadID: "thread-empty", CheckpointNS: "latest", Checkpoint: []byte{}, Metadata: []byte{}},
				}
				repo.On("ListCheckpoints", mock.Anything, 1, "").Return(records, nil)
			},
			expectedCount: 1,
			validateResults: func(t *testing.T, records []repositories.CheckpointRecord) {
				assert.Equal(t, "thread-empty", records[0].ThreadID)
				assert.Empty(t, records[0].Checkpoint)
				assert.Empty(t, records[0].Metadata)
			},
		},
		{
			name:   "database timeout error",
			limit:  10,
			before: "",
			setupMocks: func(repo *mocks.MockCheckpointRepository) {
				repo.On("ListCheckpoints", mock.Anything, 10, "").Return([]repositories.CheckpointRecord(nil), fmt.Errorf("database timeout"))
			},
			expectedErr: "database timeout",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			repo := new(mocks.MockCheckpointRepository)
			tt.setupMocks(repo)

			service := NewCheckpointService(repo)

			// Execute
			records, err := service.ListCheckpoints(tt.limit, tt.before)

			// Assert
			if tt.expectedErr != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				assert.Nil(t, records)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, records)
				assert.Equal(t, tt.expectedCount, len(records))
				if tt.validateResults != nil {
					tt.validateResults(t, records)
				}
			}

			repo.AssertExpectations(t)
		})
	}
}