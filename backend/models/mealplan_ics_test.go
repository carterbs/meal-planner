package models

import (
	"strings"
	"testing"
	"time"
)

func TestMealPlanToICS(t *testing.T) {
	plan := map[string]*Meal{
		"Monday":  {ID: 1, MealName: "Test Meal", URL: "https://example.com"},
		"Tuesday": {ID: 2, MealName: "Another Meal"},
	}
	monday := time.Date(2024, 4, 1, 0, 0, 0, 0, time.UTC)
	ics := MealPlanToICS(plan, monday)

	if !strings.Contains(ics, "BEGIN:VCALENDAR") {
		t.Errorf("ics missing calendar header")
	}
	if !strings.Contains(ics, "SUMMARY:Test Meal") {
		t.Errorf("ics missing meal summary")
	}
	if !strings.Contains(ics, "URL:https://example.com") {
		t.Errorf("ics missing meal url")
	}
	if !strings.Contains(ics, "DTSTART;VALUE=DATE:20240401") {
		t.Errorf("ics missing start date")
	}
}
