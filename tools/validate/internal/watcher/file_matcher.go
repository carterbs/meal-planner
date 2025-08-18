// Package watcher provides file watching functionality for the validate tool.
package watcher

import (
	"path/filepath"
	"strings"

	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
)

// FileMatcher handles matching files to services and filtering by extensions.
type FileMatcher struct {
	config     *config.Config
	extensions map[string]bool
}

// NewFileMatcher creates a new file matcher with the given configuration and extensions.
func NewFileMatcher(cfg *config.Config, extensions []string) *FileMatcher {
	extMap := make(map[string]bool)
	for _, ext := range extensions {
		// Ensure extensions start with a dot
		if !strings.HasPrefix(ext, ".") {
			ext = "." + ext
		}
		extMap[strings.ToLower(ext)] = true
	}
	
	// Default extensions if none provided
	if len(extMap) == 0 {
		extMap = map[string]bool{
			".go":  true,
			".ts":  true,
			".tsx": true,
			".js":  true,
			".jsx": true,
		}
	}

	return &FileMatcher{
		config:     cfg,
		extensions: extMap,
	}
}

// ShouldWatch returns true if the file should be watched based on its extension.
func (fm *FileMatcher) ShouldWatch(filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	return fm.extensions[ext]
}

// FindMatchingService finds the service that owns the given file path.
// Returns the service name and service config, or empty string and nil if no match.
func (fm *FileMatcher) FindMatchingService(filePath string) (string, *config.Service) {
	absFilePath, err := filepath.Abs(filePath)
	if err != nil {
		return "", nil
	}

	for _, service := range fm.config.Services {
		if service.Dir == "" {
			continue
		}

		serviceDir, err := filepath.Abs(service.Dir)
		if err != nil {
			continue
		}

		// Check if file is within this service directory
		relPath, err := filepath.Rel(serviceDir, absFilePath)
		if err != nil {
			continue
		}

		// If the relative path doesn't start with "..", the file is within the service directory
		if !strings.HasPrefix(relPath, "..") {
			return service.Name, &service
		}
	}

	return "", nil
}

// GetWatchedExtensions returns the list of file extensions being watched.
func (fm *FileMatcher) GetWatchedExtensions() []string {
	var extensions []string
	for ext := range fm.extensions {
		extensions = append(extensions, ext)
	}
	return extensions
}