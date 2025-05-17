package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"mealplanner/dummy"
)

func TestGenerateMealPlan_SkipDays(t *testing.T) {
	// Enable dummy mode and load sample data
	originalUseDummy := UseDummy
	UseDummy = true
	defer func() { UseDummy = originalUseDummy }()

	if err := dummy.Load("../Meal_db.csv"); err != nil {
		t.Fatalf("failed loading dummy data: %v", err)
	}

	body := []byte(`{"skip_days":["Monday","Friday"]}`)
	req, err := http.NewRequest("POST", "/api/mealplan/generate", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	GenerateMealPlan(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 got %d", rr.Code)
	}

	var resp map[string]struct {
		ID             int    `json:"id"`
		MealName       string `json:"mealName"`
		RelativeEffort int    `json:"relativeEffort"`
		URL            string `json:"url"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if _, ok := resp["Monday"]; ok {
		t.Errorf("expected Monday to be skipped")
	}
	if _, ok := resp["Friday"]; ok {
		t.Errorf("expected Friday to be skipped")
	}

	// ensure at least one other day exists
	if len(resp) == 0 {
		t.Errorf("expected some meals returned")
	}
}
