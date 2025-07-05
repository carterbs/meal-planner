package logging

import (
	"strings"
	"sync"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	Logger     *zap.SugaredLogger
	loggerOnce sync.Once
)

// GetLogger returns a named SugaredLogger, initializing the logger if necessary.
func GetLogger(name string) *zap.SugaredLogger {
	InitLogger()
	return Logger.Named(name)
}

// InitLogger initializes the global structured logger (zap) for the application.
func InitLogger() {
	loggerOnce.Do(func() {
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
		Logger = l.Sugar()
	})
}
