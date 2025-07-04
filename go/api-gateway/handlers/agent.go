package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"mealplanner/proto"
)

func StartWorkflow(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var reqBody struct {
			Participants []string `json:"participants"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req := &proto.StartWorkflowRequest{
			Participants: reqBody.Participants,
		}

		resp, err := client.StartWorkflow(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

// StartAgent proxies a start request to the Agent gRPC service
func StartAgent(client proto.AgentServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Participants []string `json:"participants"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		grpcReq := &proto.StartWorkflowRequest{Participants: req.Participants}
		resp, err := client.StartWorkflow(r.Context(), grpcReq)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func SendMessage(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var reqBody struct {
			ThreadId string `json:"thread_id"`
			Message  string `json:"message"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		req := &proto.SendMessageRequest{
			ThreadId: reqBody.ThreadId,
			Message:  reqBody.Message,
		}

		resp, err := client.SendMessage(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func GetWorkflowStatus(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		threadId := chi.URLParam(r, "thread_id")

		req := &proto.GetWorkflowStatusRequest{
			ThreadId: threadId,
		}

		resp, err := client.GetWorkflowStatus(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func ListWorkflows(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := &proto.ListWorkflowsRequest{}

		resp, err := client.ListWorkflows(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func CancelWorkflow(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		threadId := chi.URLParam(r, "thread_id")

		req := &proto.CancelWorkflowRequest{
			ThreadId: threadId,
		}

		resp, err := client.CancelWorkflow(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func HealthCheck(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := &proto.HealthCheckRequest{}

		resp, err := client.HealthCheck(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func ReconnectDatabase(client proto.BackendServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := &proto.ReconnectDatabaseRequest{}

		resp, err := client.ReconnectDatabase(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
