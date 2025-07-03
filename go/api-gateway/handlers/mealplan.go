package handlers

import (
	"encoding/json"
	"net/http"

	"mealplanner/proto"
)

func GetMealPlan(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := &proto.GetMealPlanRequest{}

		resp, err := client.GetMealPlan(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func GenerateMealPlan(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var reqBody struct {
			Force bool `json:"force"`
		}

		// Parse request body if provided, otherwise use default
		if r.Body != nil {
			json.NewDecoder(r.Body).Decode(&reqBody)
		}

		req := &proto.GenerateMealPlanRequest{
			Force: reqBody.Force,
		}

		resp, err := client.GenerateMealPlan(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func FinalizeMealPlan(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := &proto.FinalizeMealPlanRequest{}

		resp, err := client.FinalizeMealPlan(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func GetMealPlanIcs(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := &proto.GetMealPlanIcsRequest{}

		resp, err := client.GetMealPlanIcs(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/calendar")
		w.Header().Set("Content-Disposition", "attachment; filename=\"meal-plan.ics\"")
		w.Write([]byte(resp.IcsContent))
	}
}

func GenerateShoppingList(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var reqBody struct {
			MealIds []int32 `json:"meal_ids"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req := &proto.GenerateShoppingListRequest{
			MealIds: reqBody.MealIds,
		}

		resp, err := client.GenerateShoppingList(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
