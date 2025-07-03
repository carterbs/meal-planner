package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"mealplanner/proto"
)

func GetSteps(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		req := &proto.GetStepsRequest{
			MealId: int32(mealId),
		}

		resp, err := client.GetSteps(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func CreateStep(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		var reqBody struct {
			Instruction string `json:"instruction"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req := &proto.CreateStepRequest{
			MealId:      int32(mealId),
			Instruction: reqBody.Instruction,
		}

		resp, err := client.CreateStep(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func CreateStepsBulk(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		var reqBody struct {
			Instructions []string `json:"instructions"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req := &proto.CreateStepsBulkRequest{
			MealId:       int32(mealId),
			Instructions: reqBody.Instructions,
		}

		resp, err := client.CreateStepsBulk(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func UpdateStep(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		stepIdStr := chi.URLParam(r, "step_id")

		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		stepId, err := strconv.ParseInt(stepIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid step ID", http.StatusBadRequest)
			return
		}

		var reqBody struct {
			Instruction string `json:"instruction"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req := &proto.UpdateStepRequest{
			MealId:      int32(mealId),
			StepId:      int32(stepId),
			Instruction: reqBody.Instruction,
		}

		resp, err := client.UpdateStep(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func DeleteStep(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		stepIdStr := chi.URLParam(r, "step_id")

		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		stepId, err := strconv.ParseInt(stepIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid step ID", http.StatusBadRequest)
			return
		}

		req := &proto.DeleteStepRequest{
			MealId: int32(mealId),
			StepId: int32(stepId),
		}

		resp, err := client.DeleteStep(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func ReorderSteps(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		var reqBody struct {
			StepIds []int32 `json:"step_ids"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req := &proto.ReorderStepsRequest{
			MealId:  int32(mealId),
			StepIds: reqBody.StepIds,
		}

		resp, err := client.ReorderSteps(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func DeleteAllSteps(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mealIdStr := chi.URLParam(r, "meal_id")
		mealId, err := strconv.ParseInt(mealIdStr, 10, 32)
		if err != nil {
			http.Error(w, "Invalid meal ID", http.StatusBadRequest)
			return
		}

		req := &proto.DeleteAllStepsRequest{
			MealId: int32(mealId),
		}

		resp, err := client.DeleteAllSteps(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
