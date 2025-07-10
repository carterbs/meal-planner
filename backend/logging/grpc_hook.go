package logging

import (
	"context"
	"fmt"

	"go.uber.org/zap/zapcore"
)

// GrpcHook implements zapcore.Core to intercept zap logs and send them to gRPC service
type GrpcHook struct {
	zapcore.Core
	component string
}

// NewGrpcHook creates a new GrpcHook that wraps the original core
func NewGrpcHook(core zapcore.Core, component string) *GrpcHook {
	return &GrpcHook{
		Core:      core,
		component: component,
	}
}

// Write intercepts log entries and sends them to gRPC service
func (h *GrpcHook) Write(entry zapcore.Entry, fields []zapcore.Field) error {
	fmt.Printf("DEBUG: GrpcHook.Write called for level %s: %s\n", entry.Level.String(), entry.Message)

	// Send to gRPC service if available
	if useGrpcLog && grpcLogger != nil {
		fieldMap := make(map[string]string)
		for _, field := range fields {
			fieldMap[field.Key] = fmt.Sprintf("%v", field.Interface)
		}

		ctx := context.Background()
		fmt.Printf("DEBUG: Sending log to gRPC: %s - %s\n", entry.Level.String(), entry.Message)
		err := grpcLogger.LogWithDetails(ctx, entry.Level.String(), entry.Message, "", h.component, fieldMap)
		if err != nil {
			fmt.Printf("DEBUG: gRPC log failed: %v\n", err)
		} else {
			fmt.Printf("DEBUG: gRPC log successful\n")
		}
	} else {
		fmt.Printf("DEBUG: gRPC logging not available: useGrpcLog=%v, grpcLogger=%v\n", useGrpcLog, grpcLogger != nil)
	}

	// Continue with original logging
	return h.Core.Write(entry, fields)
}

// Clone creates a copy of the hook
func (h *GrpcHook) Clone() zapcore.Core {
	return &GrpcHook{
		Core:      h.Core,
		component: h.component,
	}
}

// Enabled checks if the given level is enabled
func (h *GrpcHook) Enabled(lvl zapcore.Level) bool {
	return h.Core.Enabled(lvl)
}

// With adds structured context to the Core
func (h *GrpcHook) With(fields []zapcore.Field) zapcore.Core {
	return &GrpcHook{
		Core:      h.Core.With(fields),
		component: h.component,
	}
}

// Check determines whether the supplied Entry should be logged
func (h *GrpcHook) Check(ent zapcore.Entry, ce *zapcore.CheckedEntry) *zapcore.CheckedEntry {
	if h.Enabled(ent.Level) {
		return ce.AddCore(ent, h)
	}
	return ce
}

// Sync flushes buffered logs
func (h *GrpcHook) Sync() error {
	return h.Core.Sync()
}
