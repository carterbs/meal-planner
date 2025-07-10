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
	client      pb.MealPlannerAPIClient
	conn        *grpc.ClientConn
	serviceName string
}

func NewLoggingClient(addr, serviceName string) (*LoggingClient, error) {
	conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := pb.NewMealPlannerAPIClient(conn)
	return &LoggingClient{
		client:      client,
		conn:        conn,
		serviceName: serviceName,
	}, nil
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