package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/mock"
	"mealplanner/services"
)

type MockCheckpointService struct{ mock.Mock }

func (m *MockCheckpointService) GetCheckpoint(tid, ns string) ([]byte, []byte, bool, error) {
	args := m.Called(tid, ns)
	return []byte(args.String(0)), []byte(args.String(1)), args.Bool(2), args.Error(3)
}
func (m *MockCheckpointService) PutCheckpoint(tid, ns, wt string, cp []byte, md []byte) error {
	args := m.Called(tid, ns, wt, cp, md)
	return args.Error(0)
}
func (m *MockCheckpointService) ListCheckpoints(limit int, before string) ([]services.CheckpointRecord, error) {
	args := m.Called(limit, before)
	return args.Get(0).([]services.CheckpointRecord), args.Error(1)
}

func TestGetCheckpointNotFound(t *testing.T) {
	svc := new(MockCheckpointService)
	svc.On("GetCheckpoint", "abc", "").Return("", "", false, nil)
	original := Services
	Services = &services.ServiceContainer{CheckpointService: svc}
	defer func() { Services = original }()

	req := httptest.NewRequest("GET", "/api/checkpoints/abc", nil)
	rc := chi.NewRouteContext()
	rc.URLParams.Add("thread_id", "abc")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rc))

	rr := httptest.NewRecorder()
	GetCheckpoint(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}
	var resp map[string]any
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["found"].(bool) {
		t.Fatalf("expected found=false")
	}
	svc.AssertExpectations(t)
}

func TestPutCheckpointSuccess(t *testing.T) {
	svc := new(MockCheckpointService)
	original := Services
	Services = &services.ServiceContainer{CheckpointService: svc}
	defer func() { Services = original }()

	body := map[string]any{
		"thread_id":     "t1",
		"checkpoint_ns": "n1",
		"workflow_type": "meal_planning",
		"checkpoint":    map[string]any{},
		"metadata":      map[string]any{},
	}
	b, _ := json.Marshal(body)
	svc.On("PutCheckpoint", "t1", "n1", "meal_planning", mock.Anything, mock.Anything).Return(nil)
	req := httptest.NewRequest("POST", "/api/checkpoints", bytes.NewReader(b))
	rr := httptest.NewRecorder()
	PutCheckpoint(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}
	var resp map[string]any
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if !resp["success"].(bool) {
		t.Fatalf("expected success true")
	}
	svc.AssertExpectations(t)
}
