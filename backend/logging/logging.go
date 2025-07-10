package logging

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	
	logger "logging-service/client/go"
)

var (
	Logger      *zap.SugaredLogger
	loggerOnce  sync.Once
	grpcLogger  *logger.LoggingClient
	useGrpcLog  bool
)

// GetLogger returns a named SugaredLogger, initializing the logger if necessary.
func GetLogger(name string) *zap.SugaredLogger {
	fmt.Printf("DEBUG: GetLogger called for '%s'\n", name)
	InitLogger()
	fmt.Printf("DEBUG: Returning logger for '%s', useGrpcLog=%v\n", name, useGrpcLog)
	return Logger.Named(name)
}

// GetGrpcLogger returns a logger that automatically sends logs to the gRPC service
func GetGrpcLogger(name string) *zap.SugaredLogger {
	InitLogger()
	
	if useGrpcLog && grpcLogger != nil {
		// Create a logger with gRPC hook
		config := zap.NewDevelopmentConfig()
		config.Encoding = "console"
		config.EncoderConfig.TimeKey = "time"
		config.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout("[15:04:05]")
		config.EncoderConfig.EncodeLevel = func(level zapcore.Level, enc zapcore.PrimitiveArrayEncoder) {
			levelStr := level.CapitalString()
			enc.AppendString("[" + levelStr + strings.Repeat(" ", 5-len(levelStr)) + "]")
		}
		config.EncoderConfig.EncodeName = func(loggerName string, enc zapcore.PrimitiveArrayEncoder) {
			padding := 20 - len(loggerName)
			if padding < 0 {
				padding = 0
			}
			enc.AppendString("[" + loggerName + "]" + strings.Repeat(" ", padding))
		}
		config.EncoderConfig.EncodeCaller = nil
		config.EncoderConfig.StacktraceKey = ""
		config.EncoderConfig.ConsoleSeparator = " "

		core, _ := config.Build()
		grpcCore := NewGrpcHook(core.Core(), name)
		grpcLogger := zap.New(grpcCore)
		return grpcLogger.Sugar().Named(name)
	}
	
	return Logger.Named(name)
}

// InitLogger initializes the global structured logger (zap) for the application.
func InitLogger() {
	loggerOnce.Do(func() {
		// Check if we should use gRPC logging
		loggingServiceAddr := os.Getenv("LOGGING_SERVICE_ADDR")
		if loggingServiceAddr == "" {
			loggingServiceAddr = "localhost:50052"
		}
		
		// Try to connect to gRPC logging service
		var err error
		grpcLogger, err = logger.NewLoggingClient(loggingServiceAddr, "backend")
		if err != nil {
			// Fall back to local logging if gRPC service is not available
			useGrpcLog = false
			fmt.Printf("gRPC logging service not available at %s: %v\n", loggingServiceAddr, err)
		} else {
			useGrpcLog = true
			fmt.Printf("gRPC logging service connected at %s\n", loggingServiceAddr)
		}

		// Initialize local zap logger (as fallback or for dual logging)
		config := zap.NewDevelopmentConfig()
		config.Encoding = "console"
		config.EncoderConfig.TimeKey = "time"
		config.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout("[15:04:05]")
		config.EncoderConfig.EncodeLevel = func(level zapcore.Level, enc zapcore.PrimitiveArrayEncoder) {
			levelStr := level.CapitalString()
			enc.AppendString("[" + levelStr + strings.Repeat(" ", 5-len(levelStr)) + "]")
		}
		config.EncoderConfig.EncodeName = func(loggerName string, enc zapcore.PrimitiveArrayEncoder) {
			padding := 20 - len(loggerName)
			if padding < 0 {
				padding = 0
			}
			enc.AppendString("[" + loggerName + "]" + strings.Repeat(" ", padding))
		}
		config.EncoderConfig.EncodeCaller = nil // Remove caller info unless error
		config.EncoderConfig.StacktraceKey = "" // Remove stacktrace unless error
		config.EncoderConfig.ConsoleSeparator = " "

		l, _ := config.Build()
		
		// If gRPC logging is available, wrap the logger with gRPC hook
		if useGrpcLog && grpcLogger != nil {
			fmt.Printf("DEBUG: Setting up gRPC hook for global logger\n")
			grpcCore := NewGrpcHook(l.Core(), "backend")
			l = zap.New(grpcCore)
		} else {
			fmt.Printf("DEBUG: Not using gRPC hook: useGrpcLog=%v, grpcLogger=%v\n", useGrpcLog, grpcLogger != nil)
		}
		
		Logger = l.Sugar()
	})
}

// GrpcLog sends a log message to the gRPC logging service
func GrpcLog(level, component, message string, fields map[string]string) {
	if useGrpcLog && grpcLogger != nil {
		ctx := context.Background()
		grpcLogger.LogWithDetails(ctx, level, message, "", component, fields)
	}
}
