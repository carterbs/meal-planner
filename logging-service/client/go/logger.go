package logger

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "mealplanner/generated/go"
)

type LoggingClient struct {
	client      pb.LoggingServiceClient
	conn        *grpc.ClientConn
	serviceName string
}

func NewLoggingClient(addr, serviceName string) (*LoggingClient, error) {
	// Emit diagnostic logs to help troubleshoot connectivity issues to the centralized
	// logging service. These will appear in standard output of the calling process
	// (e.g. container logs) even before the structured logger is fully configured.
	start := time.Now()
	fmt.Printf("[LoggingClient] Attempting to connect to logging service at %s\n", addr)

	// Retry logic for connecting to logging service
	maxRetries := 30              // 30 attempts
	retryDelay := 2 * time.Second // 2 seconds between attempts

	for attempt := 1; attempt <= maxRetries; attempt++ {
		fmt.Printf("[LoggingClient] Connection attempt %d/%d\n", attempt, maxRetries)

		// Dial in blocking mode so we immediately know if the service is reachable. Use a
		// short timeout so application start-up is not unduly delayed.
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

		conn, err := grpc.DialContext(
			ctx,
			addr,
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithBlock(),
		)
		cancel() // Cancel the context immediately after dial

		if err != nil {
			fmt.Printf("[LoggingClient] Failed to connect to logging service at %s (attempt %d/%d): %v\n", addr, attempt, maxRetries, err)

			if attempt == maxRetries {
				fmt.Printf("[LoggingClient] Failed to connect after %d attempts\n", maxRetries)
				return nil, err
			}

			// Wait before retrying
			time.Sleep(retryDelay)
			continue
		}

		fmt.Printf("[LoggingClient] Connected to logging service at %s (took %s, attempt %d)\n", addr, time.Since(start), attempt)

		client := pb.NewLoggingServiceClient(conn)
		return &LoggingClient{
			client:      client,
			conn:        conn,
			serviceName: serviceName,
		}, nil
	}

	// This should never be reached, but just in case
	return nil, fmt.Errorf("failed to connect to logging service after %d attempts", maxRetries)
}

func (c *LoggingClient) Close() error {
	return c.conn.Close()
}

func (c *LoggingClient) Log(ctx context.Context, level, message string, fields map[string]string) error {
	return c.LogWithDetails(ctx, level, message, "", "", fields)
}

func (c *LoggingClient) LogWithDetails(ctx context.Context, level, message, threadID, component string, fields map[string]string) error {
	entry := &pb.LogEntry{
		ServiceName: c.serviceName,
		Level:       level,
		Message:     message,
		Timestamp:   timestamppb.New(time.Now()),
		ThreadId:    threadID,
		Component:   component,
		Fields:      fields,
	}

	req := &pb.LogRequest{Entry: entry}
	_, err := c.client.Log(ctx, req)
	return err
}

func (c *LoggingClient) Debug(ctx context.Context, message string, fields map[string]string) error {
	return c.Log(ctx, "DEBUG", message, fields)
}

func (c *LoggingClient) Info(ctx context.Context, message string, fields map[string]string) error {
	return c.Log(ctx, "INFO", message, fields)
}

func (c *LoggingClient) Warn(ctx context.Context, message string, fields map[string]string) error {
	return c.Log(ctx, "WARN", message, fields)
}

func (c *LoggingClient) Error(ctx context.Context, message string, fields map[string]string) error {
	return c.Log(ctx, "ERROR", message, fields)
}

func (c *LoggingClient) LogBatch(ctx context.Context, entries []*pb.LogEntry) error {
	req := &pb.LogBatchRequest{Entries: entries}
	_, err := c.client.LogBatch(ctx, req)
	return err
}

// ZapLogger wraps the logging client to provide a zap-compatible interface
type ZapLogger struct {
	client *LoggingClient
}

func NewZapLogger(client *LoggingClient) *ZapLogger {
	return &ZapLogger{client: client}
}

func (z *ZapLogger) Debug(msg string, fields ...zap.Field) {
	fieldMap := zapFieldsToMap(fields)
	z.client.Debug(context.Background(), msg, fieldMap)
}

func (z *ZapLogger) Info(msg string, fields ...zap.Field) {
	fieldMap := zapFieldsToMap(fields)
	z.client.Info(context.Background(), msg, fieldMap)
}

func (z *ZapLogger) Warn(msg string, fields ...zap.Field) {
	fieldMap := zapFieldsToMap(fields)
	z.client.Warn(context.Background(), msg, fieldMap)
}

func (z *ZapLogger) Error(msg string, fields ...zap.Field) {
	fieldMap := zapFieldsToMap(fields)
	z.client.Error(context.Background(), msg, fieldMap)
}

func zapFieldsToMap(fields []zap.Field) map[string]string {
	result := make(map[string]string)
	for _, field := range fields {
		switch field.Type {
		case zapcore.StringType:
			result[field.Key] = field.String
		case zapcore.Int64Type:
			result[field.Key] = fmt.Sprintf("%d", field.Integer)
		case zapcore.BoolType:
			result[field.Key] = fmt.Sprintf("%t", field.Integer == 1)
		default:
			result[field.Key] = field.String
		}
	}
	return result
}
