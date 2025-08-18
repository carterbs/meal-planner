package watcher

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
)

// FileEvent represents a file change event.
type FileEvent struct {
	Path        string
	ServiceName string
	Service     *config.Service
}

// EventHandler is called when file events are detected.
type EventHandler func(events []FileEvent) error

// Watcher monitors file system changes and reports relevant events.
type Watcher struct {
	config      *config.Config
	fileMatcher *FileMatcher
	fsWatcher   *fsnotify.Watcher
	debounceMS  int
	
	// Event handling
	eventHandler EventHandler
	eventBuffer  []FileEvent
	eventMutex   sync.Mutex
	debounceTimer *time.Timer
}

// Options configures the file watcher.
type Options struct {
	Extensions []string
	DebounceMS int
}

// NewWatcher creates a new file watcher with the given configuration.
func NewWatcher(cfg *config.Config, handler EventHandler, opts Options) (*Watcher, error) {
	fsWatcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("failed to create file watcher: %w", err)
	}

	debounceMS := opts.DebounceMS
	if debounceMS <= 0 {
		debounceMS = 300 // Default 300ms debounce
	}

	fileMatcher := NewFileMatcher(cfg, opts.Extensions)

	return &Watcher{
		config:       cfg,
		fileMatcher:  fileMatcher,
		fsWatcher:    fsWatcher,
		debounceMS:   debounceMS,
		eventHandler: handler,
		eventBuffer:  make([]FileEvent, 0),
	}, nil
}

// Start begins watching for file changes in all configured service directories.
func (w *Watcher) Start(ctx context.Context) error {
	// Add all service directories to the watcher
	for _, service := range w.config.Services {
		if service.Dir == "" {
			continue
		}

		absDir, err := filepath.Abs(service.Dir)
		if err != nil {
			return fmt.Errorf("failed to get absolute path for %s: %w", service.Dir, err)
		}

		// Watch the directory recursively
		err = w.addRecursive(absDir)
		if err != nil {
			return fmt.Errorf("failed to add directory %s to watcher: %w", absDir, err)
		}
	}

	// Start event processing goroutine
	go w.processEvents(ctx)

	return nil
}

// Stop stops the file watcher and cleans up resources.
func (w *Watcher) Stop() error {
	if w.debounceTimer != nil {
		w.debounceTimer.Stop()
	}
	return w.fsWatcher.Close()
}

// addRecursive adds a directory and all its subdirectories to the watcher.
func (w *Watcher) addRecursive(dir string) error {
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if info.IsDir() {
			// Skip hidden directories and common build/cache directories
			dirName := filepath.Base(path)
			if strings.HasPrefix(dirName, ".") || 
			   dirName == "node_modules" ||
			   dirName == "dist" ||
			   dirName == "build" ||
			   dirName == "coverage" {
				return filepath.SkipDir
			}
			
			return w.fsWatcher.Add(path)
		}
		
		return nil
	})
}

// processEvents handles file system events with debouncing.
func (w *Watcher) processEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
			
		case event, ok := <-w.fsWatcher.Events:
			if !ok {
				return
			}
			
			w.handleFileEvent(event)
			
		case err, ok := <-w.fsWatcher.Errors:
			if !ok {
				return
			}
			
			// Log error but continue watching
			fmt.Printf("File watcher error: %v\n", err)
		}
	}
}

// handleFileEvent processes a single file system event.
func (w *Watcher) handleFileEvent(event fsnotify.Event) {
	// Only process write and create events
	if !(event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create) {
		return
	}

	// Check if this file should be watched
	if !w.fileMatcher.ShouldWatch(event.Name) {
		return
	}

	// Find the service that owns this file
	serviceName, service := w.fileMatcher.FindMatchingService(event.Name)
	if serviceName == "" || service == nil {
		return
	}

	// Add to event buffer with debouncing
	w.eventMutex.Lock()
	defer w.eventMutex.Unlock()

	// Add the event to the buffer
	fileEvent := FileEvent{
		Path:        event.Name,
		ServiceName: serviceName,
		Service:     service,
	}
	
	// Check if this file is already in the buffer
	found := false
	for i, existing := range w.eventBuffer {
		if existing.Path == fileEvent.Path {
			w.eventBuffer[i] = fileEvent // Update existing entry
			found = true
			break
		}
	}
	
	if !found {
		w.eventBuffer = append(w.eventBuffer, fileEvent)
	}

	// Reset or start debounce timer
	if w.debounceTimer != nil {
		w.debounceTimer.Stop()
	}
	
	w.debounceTimer = time.AfterFunc(time.Duration(w.debounceMS)*time.Millisecond, func() {
		w.flushEvents()
	})
}

// flushEvents sends the buffered events to the handler and clears the buffer.
func (w *Watcher) flushEvents() {
	w.eventMutex.Lock()
	events := make([]FileEvent, len(w.eventBuffer))
	copy(events, w.eventBuffer)
	w.eventBuffer = w.eventBuffer[:0] // Clear buffer
	w.eventMutex.Unlock()

	if len(events) > 0 && w.eventHandler != nil {
		if err := w.eventHandler(events); err != nil {
			fmt.Printf("Error handling file events: %v\n", err)
		}
	}
}

// GetWatchedExtensions returns the list of file extensions being watched.
func (w *Watcher) GetWatchedExtensions() []string {
	return w.fileMatcher.GetWatchedExtensions()
}