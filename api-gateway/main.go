package main

import (
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	logger "logging-service/client/go"
)

func main() {
	// Initialize logging client
	ctx := context.Background()
	loggingServiceAddr := os.Getenv("LOGGING_SERVICE_ADDR")
	if loggingServiceAddr == "" {
		loggingServiceAddr = "localhost:50052"
	}
	
	grpcLogger, err := logger.NewLoggingClient(loggingServiceAddr, "api-gateway")
	if err != nil {
		log.Printf("gRPC logging service not available at %s: %v, falling back to console", loggingServiceAddr, err)
	}

	// Parse the target URL (backend on 8090)
	target, err := url.Parse("http://localhost:8090")
	if err != nil {
		if grpcLogger != nil {
			grpcLogger.LogWithDetails(ctx, "FATAL", "Failed to parse target URL: "+err.Error(), "", "api-gateway", nil)
		}
		log.Fatal("Failed to parse target URL:", err)
	}

	// Create a reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Create HTTP server on port 8080
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Enable CORS for development
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		// Forward the request
		proxy.ServeHTTP(w, r)
	})

	if grpcLogger != nil {
		grpcLogger.LogWithDetails(ctx, "INFO", "API Gateway starting on :8080, forwarding to backend :8090", "", "api-gateway", nil)
	}
	log.Println("API Gateway starting on :8080, forwarding to backend :8090")
	log.Fatal(http.ListenAndServe(":8080", nil))
}