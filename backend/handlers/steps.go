package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"mealplanner/models"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

// GetStepsHandler handles GET /api/meals/{mealId}/steps and returns all steps for a meal.
func GetStepsHandler(w http.ResponseWriter, r *http.Request) {
	mealIDStr := chi.URLParam(r, "mealId")
	if mealIDStr == "" {
		http.Error(w, "Missing meal ID", http.StatusBadRequest)
		return
	}

	mealID, err := strconv.Atoi(mealIDStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	steps, err := models.GetStepsForMeal(DB, mealID)
	if err != nil {
		http.Error(w, "Error retrieving steps: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(steps)
}

// AddStepHandler handles POST /api/meals/{mealId}/steps and adds a new step to a meal.
func AddStepHandler(w http.ResponseWriter, r *http.Request) {
	mealIDStr := chi.URLParam(r, "mealId")
	if mealIDStr == "" {
		http.Error(w, "Missing meal ID", http.StatusBadRequest)
		return
	}

	mealID, err := strconv.Atoi(mealIDStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	var step models.Step
	if err := json.NewDecoder(r.Body).Decode(&step); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Ensure the step is associated with the correct meal
	step.MealID = mealID

	createdStep, err := models.AddStepToMeal(DB, step)
	if err != nil {
		http.Error(w, "Error adding step: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdStep)
}

// AddBulkStepsHandler handles POST /api/meals/{mealId}/steps/bulk and adds multiple steps to a meal from text.
func AddBulkStepsHandler(w http.ResponseWriter, r *http.Request) {
	mealIDStr := chi.URLParam(r, "mealId")
	if mealIDStr == "" {
		http.Error(w, "Missing meal ID", http.StatusBadRequest)
		return
	}

	mealID, err := strconv.Atoi(mealIDStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	// Handle two types of requests:
	// 1. JSON array of steps (for structured input)
	// 2. Plain text (for bulk pasting)
	contentType := r.Header.Get("Content-Type")

	var instructions []string

	if strings.Contains(contentType, "application/json") {
		// Try to parse as JSON first
		var payload struct {
			Text         string   `json:"text,omitempty"`
			Instructions []string `json:"instructions,omitempty"`
		}

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid JSON payload: "+err.Error(), http.StatusBadRequest)
			return
		}

		if len(payload.Instructions) > 0 {
			// Use pre-parsed instructions if provided
			instructions = payload.Instructions
		} else if payload.Text != "" {
			// Parse text into instructions
			instructions = parseStepsFromText(payload.Text)
		} else {
			http.Error(w, "Either 'text' or 'instructions' must be provided", http.StatusBadRequest)
			return
		}
	} else {
		// Assume plain text for any other content type
		buf := new(strings.Builder)
		_, err := io.Copy(buf, r.Body)
		if err != nil {
			http.Error(w, "Error reading request body: "+err.Error(), http.StatusBadRequest)
			return
		}

		text := buf.String()
		if text == "" {
			http.Error(w, "Empty request body", http.StatusBadRequest)
			return
		}

		instructions = parseStepsFromText(text)
	}

	// Filter out empty instructions
	var nonEmptyInstructions []string
	for _, instruction := range instructions {
		if strings.TrimSpace(instruction) != "" {
			nonEmptyInstructions = append(nonEmptyInstructions, instruction)
		}
	}

	if len(nonEmptyInstructions) == 0 {
		http.Error(w, "No valid steps found in the input", http.StatusBadRequest)
		return
	}

	steps, err := models.AddMultipleStepsToMeal(DB, mealID, nonEmptyInstructions)
	if err != nil {
		http.Error(w, "Error adding steps: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(steps)
}

// parseStepsFromText intelligently parses steps from text input
func parseStepsFromText(text string) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return []string{}
	}

	// Try different parsing strategies in order of preference

	// 1. Check for numbered steps (e.g., "1. Do this", "2. Do that")
	numberedPattern := regexp.MustCompile(`(?m)^\s*\d+\.?\s+(.+)$`)
	if matches := numberedPattern.FindAllStringSubmatch(text, -1); len(matches) > 0 {
		var steps []string
		for _, match := range matches {
			if len(match) > 1 {
				steps = append(steps, strings.TrimSpace(match[1]))
			}
		}
		if len(steps) > 0 {
			return steps
		}
	}

	// 2. Check for bullet points (-, *, •)
	bulletPattern := regexp.MustCompile(`(?m)^\s*[-*•]\s+(.+)$`)
	if matches := bulletPattern.FindAllStringSubmatch(text, -1); len(matches) > 0 {
		var steps []string
		for _, match := range matches {
			if len(match) > 1 {
				steps = append(steps, strings.TrimSpace(match[1]))
			}
		}
		if len(steps) > 0 {
			return steps
		}
	}

	// 3. Split by double newlines (paragraphs)
	if strings.Contains(text, "\n\n") {
		paragraphs := strings.Split(text, "\n\n")
		var steps []string
		for _, p := range paragraphs {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				steps = append(steps, trimmed)
			}
		}
		if len(steps) > 0 {
			return steps
		}
	}

	// 4. Split by single newlines
	if strings.Contains(text, "\n") {
		lines := strings.Split(text, "\n")
		var steps []string
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed != "" {
				steps = append(steps, trimmed)
			}
		}
		if len(steps) > 0 {
			return steps
		}
	}

	// 5. If no structured format detected and it's a single block of text
	// Try to split by sentences if it's long enough
	if len(text) > 100 {
		sentencePattern := regexp.MustCompile(`[.!?]+\s+`)
		sentences := sentencePattern.Split(text, -1)
		var steps []string
		for _, sentence := range sentences {
			trimmed := strings.TrimSpace(sentence)
			if trimmed != "" && len(trimmed) > 10 { // Ignore very short fragments
				// Add back the period if it doesn't end with punctuation
				if !strings.HasSuffix(trimmed, ".") && !strings.HasSuffix(trimmed, "!") && !strings.HasSuffix(trimmed, "?") {
					trimmed += "."
				}
				steps = append(steps, trimmed)
			}
		}
		if len(steps) > 0 {
			return steps
		}
	}

	// If all else fails, treat the whole text as one step
	return []string{text}
}

// UpdateStepHandler handles PUT /api/meals/{mealId}/steps/{stepId} and updates a step.
func UpdateStepHandler(w http.ResponseWriter, r *http.Request) {
	mealIDStr := chi.URLParam(r, "mealId")
	stepIDStr := chi.URLParam(r, "stepId")

	if mealIDStr == "" || stepIDStr == "" {
		http.Error(w, "Missing required parameters", http.StatusBadRequest)
		return
	}

	mealID, err := strconv.Atoi(mealIDStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	stepID, err := strconv.Atoi(stepIDStr)
	if err != nil {
		http.Error(w, "Invalid step ID", http.StatusBadRequest)
		return
	}

	var step models.Step
	if err := json.NewDecoder(r.Body).Decode(&step); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Ensure the IDs are set correctly
	step.ID = stepID
	step.MealID = mealID

	if err := models.UpdateStep(DB, step); err != nil {
		http.Error(w, "Error updating step: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"message":"Step updated successfully"}`)
}

// DeleteStepHandler handles DELETE /api/meals/{mealId}/steps/{stepId} and deletes a step.
func DeleteStepHandler(w http.ResponseWriter, r *http.Request) {
	mealIDStr := chi.URLParam(r, "mealId")
	stepIDStr := chi.URLParam(r, "stepId")

	if mealIDStr == "" || stepIDStr == "" {
		http.Error(w, "Missing required parameters", http.StatusBadRequest)
		return
	}

	mealID, err := strconv.Atoi(mealIDStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	stepID, err := strconv.Atoi(stepIDStr)
	if err != nil {
		http.Error(w, "Invalid step ID", http.StatusBadRequest)
		return
	}

	if err := models.DeleteStep(DB, stepID, mealID); err != nil {
		http.Error(w, "Error deleting step: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"message":"Step deleted successfully"}`)
}

// ReorderStepsHandler handles PUT /api/meals/{mealId}/steps/reorder and reorders steps.
func ReorderStepsHandler(w http.ResponseWriter, r *http.Request) {
	mealIDStr := chi.URLParam(r, "mealId")
	if mealIDStr == "" {
		http.Error(w, "Missing meal ID", http.StatusBadRequest)
		return
	}

	mealID, err := strconv.Atoi(mealIDStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	var payload struct {
		StepIDs []int `json:"stepIds"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	if len(payload.StepIDs) == 0 {
		http.Error(w, "No step IDs provided", http.StatusBadRequest)
		return
	}

	if err := models.ReorderSteps(DB, mealID, payload.StepIDs); err != nil {
		http.Error(w, "Error reordering steps: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"message":"Steps reordered successfully"}`)
}

// DeleteAllStepsHandler handles DELETE /api/meals/{mealId}/steps and deletes all steps for a meal.
func DeleteAllStepsHandler(w http.ResponseWriter, r *http.Request) {
	mealIDStr := chi.URLParam(r, "mealId")
	if mealIDStr == "" {
		http.Error(w, "Missing meal ID", http.StatusBadRequest)
		return
	}

	mealID, err := strconv.Atoi(mealIDStr)
	if err != nil {
		http.Error(w, "Invalid meal ID", http.StatusBadRequest)
		return
	}

	if err := models.DeleteAllStepsForMeal(DB, mealID); err != nil {
		http.Error(w, "Error deleting steps: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"message":"All steps deleted successfully"}`)
}
