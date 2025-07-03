package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"mealplanner/proto"
)

func UpdateIngredient(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		ingredientIdStr := chi.URLParam(r, "ingredient_id")

		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		ingredientId, err := strconv.ParseInt(ingredientIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid ingredient ID", http.StatusBadRequest)
			return
		}

		var reqBody struct {
			Quantity float64 `json:"quantity"`
			Unit     string  `json:"unit"`
			Name     string  `json:"name"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req := &proto.UpdateIngredientRequest{
			MealId:       int32(mealId),
			IngredientId: int32(ingredientId),
			Quantity:     reqBody.Quantity,
			Unit:         reqBody.Unit,
			Name:         reqBody.Name,
		}

		resp, err := client.UpdateIngredient(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func DeleteIngredient(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		ingredientIdStr := chi.URLParam(r, "ingredient_id")

		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		ingredientId, err := strconv.ParseInt(ingredientIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid ingredient ID", http.StatusBadRequest)
			return
		}

		req := &proto.DeleteIngredientRequest{
			MealId:       int32(mealId),
			IngredientId: int32(ingredientId),
		}

		resp, err := client.DeleteIngredient(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
