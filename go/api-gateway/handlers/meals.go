package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"mealplanner/proto"
)

func GetAllMeals(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealType := r.URL.Query().Get("meal_type")

		req := &proto.GetAllMealsRequest{
			MealType: mealType,
		}

		resp, err := client.GetAllMeals(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func CreateMeal(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req proto.CreateMealRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		resp, err := client.CreateMeal(r.Context(), &req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func DeleteMeal(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseInt(idStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		req := &proto.DeleteMealRequest{
			MealId: int32(id),
		}

		resp, err := client.DeleteMeal(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func SwapMeal(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req proto.SwapMealRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		resp, err := client.SwapMeal(r.Context(), &req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func RemoveMeal(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseInt(idStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		req := &proto.RemoveMealRequest{
			MealId: int32(id),
		}

		resp, err := client.RemoveMeal(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func ReplaceMeal(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		oldIdStr := chi.URLParam(r, "old_id")
		newIdStr := chi.URLParam(r, "new_id")

		oldId, err := strconv.ParseInt(oldIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid old meal ID", http.StatusBadRequest)
			return
		}

		newId, err := strconv.ParseInt(newIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid new meal ID", http.StatusBadRequest)
			return
		}

		// Get additional parameters from query string or request body
		dayIndexStr := r.URL.Query().Get("day_index")
		mealType := r.URL.Query().Get("meal_type")

		dayIndex, err := strconv.ParseInt(dayIndexStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid day index", http.StatusBadRequest)
			return
		}

		req := &proto.ReplaceMealRequest{
			OldMealId: int32(oldId),
			NewMealId: int32(newId),
			DayIndex:  int32(dayIndex),
			MealType:  mealType,
		}

		resp, err := client.ReplaceMeal(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
