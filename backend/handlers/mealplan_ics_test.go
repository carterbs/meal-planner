package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"mealplanner/dummy"
)

func TestMealPlanICSHandler(t *testing.T) {
	originalUseDummy := UseDummy
	UseDummy = true
	defer func() { UseDummy = originalUseDummy }()

	if err := dummy.Load("../Meal_db.csv"); err != nil {
		t.Fatalf("failed loading dummy data: %v", err)
	}

	req, err := http.NewRequest("GET", "/api/mealplan/ics", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	rr := httptest.NewRecorder()

	MealPlanICSHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "text/calendar" {
		t.Errorf("unexpected content type %s", ct)
	}
	if len(rr.Body.String()) == 0 || !strings.Contains(rr.Body.String(), "BEGIN:VCALENDAR") {
		t.Errorf("invalid ics output")
	}
}
