package logging

import (
	"sync"

	"go.uber.org/zap"
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
		l, _ := zap.NewDevelopment()
		Logger = l.Sugar()
	})
}
