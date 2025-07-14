package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gopkg.in/natefinch/lumberjack.v2"

	pb "mealplanner/generated/go"
)

type LoggingService struct {
	pb.UnimplementedLoggingServiceServer
	logger *zap.Logger
	writer *lumberjack.Logger
}

func NewLoggingService() *LoggingService {
	// Create rotating log writer (1MB max, 3 files)
	writer := &lumberjack.Logger{
		Filename:   "./logs/unified.log",
		MaxSize:    1, // MB
		MaxBackups: 3,
		MaxAge:     0, // days (0 means no age limit)
		Compress:   false,
	}

	// Create directory if it doesn't exist
	if err := os.MkdirAll("./logs", 0755); err != nil {
		log.Fatalf("Failed to create logs directory: %v", err)
	}

	// Create zap logger for internal logging
	core := zapcore.NewCore(
		zapcore.NewJSONEncoder(zap.NewProductionEncoderConfig()),
		zapcore.AddSync(os.Stdout),
		zap.InfoLevel,
	)
	logger := zap.New(core)

	return &LoggingService{
		logger: logger,
		writer: writer,
	}
}

func (s *LoggingService) Log(ctx context.Context, req *pb.LogRequest) (*pb.LogResponse, error) {
	fmt.Println("[LOGGING-SERVICE] Received Log request")
	
	if req.Entry == nil {
		fmt.Println("[LOGGING-SERVICE] ERROR: log entry is nil")
		return &pb.LogResponse{
			Success: false,
			Message: "log entry is required",
		}, status.Error(codes.InvalidArgument, "log entry is required")
	}

	fmt.Printf("[LOGGING-SERVICE] Processing log entry from service: %s, level: %s, message: %s\n", 
		req.Entry.ServiceName, req.Entry.Level, req.Entry.Message)

	if err := s.writeLogEntry(req.Entry); err != nil {
		fmt.Printf("[LOGGING-SERVICE] ERROR: Failed to write log entry: %v\n", err)
		s.logger.Error("Failed to write log entry", zap.Error(err))
		return &pb.LogResponse{
			Success: false,
			Message: fmt.Sprintf("failed to write log: %v", err),
		}, status.Error(codes.Internal, "failed to write log")
	}

	fmt.Println("[LOGGING-SERVICE] Log entry written successfully")
	return &pb.LogResponse{
		Success: true,
		Message: "log entry written successfully",
	}, nil
}

func (s *LoggingService) LogBatch(ctx context.Context, req *pb.LogBatchRequest) (*pb.LogBatchResponse, error) {
	if len(req.Entries) == 0 {
		return &pb.LogBatchResponse{
			Success:   false,
			Processed: 0,
			Errors:    []string{"no log entries provided"},
		}, status.Error(codes.InvalidArgument, "no log entries provided")
	}

	processed := 0
	var errors []string

	for i, entry := range req.Entries {
		if err := s.writeLogEntry(entry); err != nil {
			errors = append(errors, fmt.Sprintf("entry %d: %v", i, err))
		} else {
			processed++
		}
	}

	success := len(errors) == 0
	return &pb.LogBatchResponse{
		Success:   success,
		Processed: int32(processed),
		Errors:    errors,
	}, nil
}

func (s *LoggingService) writeLogEntry(entry *pb.LogEntry) error {
	// Convert timestamp
	var timestamp time.Time
	if entry.Timestamp != nil {
		timestamp = entry.Timestamp.AsTime()
	} else {
		timestamp = time.Now()
	}

	// Create structured log entry
	logData := map[string]interface{}{
		"timestamp": timestamp.Format(time.RFC3339Nano),
		"service":   entry.ServiceName,
		"level":     entry.Level,
		"message":   entry.Message,
		"component": entry.Component,
		"thread_id": entry.ThreadId,
		"fields":    entry.Fields,
	}
	fmt.Println("Log entry:", entry.ServiceName, entry.Message)
	// Convert to JSON
	jsonData, err := json.Marshal(logData)
	if err != nil {
		return fmt.Errorf("failed to marshal log entry: %w", err)
	}

	// Write to file
	if _, err := s.writer.Write(append(jsonData, '\n')); err != nil {
		return fmt.Errorf("failed to write to log file: %w", err)
	}

	return nil
}

func (s *LoggingService) Close() error {
	if err := s.writer.Close(); err != nil {
		return err
	}
	return s.logger.Sync()
}

func main() {
	port := os.Getenv("LOGGING_SERVICE_PORT")
	if port == "" {
		port = "50052"
	}

	service := NewLoggingService()
	defer service.Close()

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	// Add unary interceptor for debugging
	unaryInterceptor := func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		fmt.Printf("[LOGGING-SERVICE] Received gRPC call: %s\n", info.FullMethod)
		resp, err := handler(ctx, req)
		if err != nil {
			fmt.Printf("[LOGGING-SERVICE] gRPC call failed: %v\n", err)
		} else {
			fmt.Printf("[LOGGING-SERVICE] gRPC call succeeded\n")
		}
		return resp, err
	}

	grpcServer := grpc.NewServer(grpc.UnaryInterceptor(unaryInterceptor))
	pb.RegisterLoggingServiceServer(grpcServer, service)
	
	fmt.Printf("[LOGGING-SERVICE] Registered LoggingService server on port %s\n", port)
	fmt.Println("[LOGGING-SERVICE] Available methods:")
	for serviceName, serviceInfo := range grpcServer.GetServiceInfo() {
		fmt.Printf("  Service: %s\n", serviceName)
		for _, methodInfo := range serviceInfo.Methods {
			fmt.Printf("    Method: %s\n", methodInfo.Name)
		}
	}

	// Handle graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		service.logger.Info("Shutting down logging service...")
		grpcServer.GracefulStop()
	}()

	service.logger.Info("Starting logging service", zap.String("port", port))
	if err := grpcServer.Serve(lis); err != nil {
        fmt.Fprintf(os.Stderr, "[LOGGING-SERVICE] grpcServer.Serve returned error: %v\n", err)
        log.Fatalf("Failed to serve: %v", err)
    }
}
