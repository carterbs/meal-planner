package watcher

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/bradcarter-meal-planner/tools/validate/internal/config"
)

func TestNewWatcher(t *testing.T) {
	cfg := &config.Config{
		Services: []config.Service{
			{Name: "ui", Type: "node", Dir: "./ui"},
		},
	}

	handler := func(events []FileEvent) error { return nil }
	opts := Options{
		Extensions: []string{".go", ".ts"},
		DebounceMS: 500,
	}

	watcher, err := NewWatcher(cfg, handler, opts)
	if err != nil {
		t.Fatalf("NewWatcher failed: %v", err)
	}
	defer watcher.Stop()

	if watcher.config != cfg {
		t.Error("config not properly set")
	}
	if watcher.eventHandler == nil {
		t.Error("event handler not set")
	}
	if watcher.debounceMS != 500 {
		t.Errorf("expected debounceMS 500, got %d", watcher.debounceMS)
	}
}

func TestNewWatcher_DefaultDebounce(t *testing.T) {
	cfg := &config.Config{}
	handler := func(events []FileEvent) error { return nil }
	opts := Options{} // No debounce specified

	watcher, err := NewWatcher(cfg, handler, opts)
	if err != nil {
		t.Fatalf("NewWatcher failed: %v", err)
	}
	defer watcher.Stop()

	if watcher.debounceMS != 300 {
		t.Errorf("expected default debounceMS 300, got %d", watcher.debounceMS)
	}
}

func TestWatcher_GetWatchedExtensions(t *testing.T) {
	cfg := &config.Config{}
	handler := func(events []FileEvent) error { return nil }
	opts := Options{Extensions: []string{".go", ".ts"}}

	watcher, err := NewWatcher(cfg, handler, opts)
	if err != nil {
		t.Fatalf("NewWatcher failed: %v", err)
	}
	defer watcher.Stop()

	extensions := watcher.GetWatchedExtensions()
	if len(extensions) != 2 {
		t.Errorf("expected 2 extensions, got %d", len(extensions))
	}

	extMap := make(map[string]bool)
	for _, ext := range extensions {
		extMap[ext] = true
	}

	if !extMap[".go"] || !extMap[".ts"] {
		t.Error("expected extensions .go and .ts not found")
	}
}

func TestWatcher_Integration(t *testing.T) {
	// Create temporary directory structure
	tempDir, err := ioutil.TempDir("", "watcher-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create service directories
	uiDir := filepath.Join(tempDir, "ui")
	if err := os.MkdirAll(uiDir, 0755); err != nil {
		t.Fatalf("Failed to create ui dir: %v", err)
	}

	// Configure services with absolute paths
	cfg := &config.Config{
		Services: []config.Service{
			{Name: "ui", Type: "node", Dir: uiDir},
		},
	}

	// Set up event collection
	var events []FileEvent
	var eventsMutex sync.Mutex
	var eventReceived sync.WaitGroup

	handler := func(receivedEvents []FileEvent) error {
		eventsMutex.Lock()
		events = append(events, receivedEvents...)
		eventsMutex.Unlock()
		eventReceived.Done()
		return nil
	}

	opts := Options{
		Extensions: []string{".ts"},
		DebounceMS: 100, // Short debounce for testing
	}

	watcher, err := NewWatcher(cfg, handler, opts)
	if err != nil {
		t.Fatalf("NewWatcher failed: %v", err)
	}
	defer watcher.Stop()

	// Start watching
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := watcher.Start(ctx); err != nil {
		t.Fatalf("Failed to start watcher: %v", err)
	}

	// Wait a moment for watcher to initialize
	time.Sleep(100 * time.Millisecond)

	// Set up expectation for one event
	eventReceived.Add(1)

	// Create a file that should be watched
	testFile := filepath.Join(uiDir, "test.ts")
	if err := ioutil.WriteFile(testFile, []byte("// test file"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Wait for event or timeout
	done := make(chan bool)
	go func() {
		eventReceived.Wait()
		done <- true
	}()

	select {
	case <-done:
		// Event received
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for file event")
	}

	// Verify event
	eventsMutex.Lock()
	defer eventsMutex.Unlock()

	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}

	event := events[0]
	if event.ServiceName != "ui" {
		t.Errorf("expected service name 'ui', got '%s'", event.ServiceName)
	}
	if event.Service == nil || event.Service.Name != "ui" {
		t.Error("expected event.Service to be ui service")
	}
	if event.Path != testFile {
		t.Errorf("expected path %s, got %s", testFile, event.Path)
	}
}

func TestWatcher_IgnoresUnwatchedFiles(t *testing.T) {
	// Create temporary directory structure
	tempDir, err := ioutil.TempDir("", "watcher-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create service directories
	uiDir := filepath.Join(tempDir, "ui")
	if err := os.MkdirAll(uiDir, 0755); err != nil {
		t.Fatalf("Failed to create ui dir: %v", err)
	}

	// Configure services
	cfg := &config.Config{
		Services: []config.Service{
			{Name: "ui", Type: "node", Dir: uiDir},
		},
	}

	// Set up event collection
	var events []FileEvent
	var eventsMutex sync.Mutex

	handler := func(receivedEvents []FileEvent) error {
		eventsMutex.Lock()
		events = append(events, receivedEvents...)
		eventsMutex.Unlock()
		return nil
	}

	opts := Options{
		Extensions: []string{".ts"}, // Only watch .ts files
		DebounceMS: 100,
	}

	watcher, err := NewWatcher(cfg, handler, opts)
	if err != nil {
		t.Fatalf("NewWatcher failed: %v", err)
	}
	defer watcher.Stop()

	// Start watching
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := watcher.Start(ctx); err != nil {
		t.Fatalf("Failed to start watcher: %v", err)
	}

	// Wait a moment for watcher to initialize
	time.Sleep(100 * time.Millisecond)

	// Create a file that should NOT be watched (wrong extension)
	unwatchedFile := filepath.Join(uiDir, "test.md")
	if err := ioutil.WriteFile(unwatchedFile, []byte("# test file"), 0644); err != nil {
		t.Fatalf("Failed to create unwatched file: %v", err)
	}

	// Create a file outside service directory
	outsideFile := filepath.Join(tempDir, "outside.ts")
	if err := ioutil.WriteFile(outsideFile, []byte("// outside"), 0644); err != nil {
		t.Fatalf("Failed to create outside file: %v", err)
	}

	// Wait to ensure no events are generated
	time.Sleep(300 * time.Millisecond)

	// Verify no events were received
	eventsMutex.Lock()
	defer eventsMutex.Unlock()

	if len(events) != 0 {
		t.Errorf("expected 0 events, got %d", len(events))
	}
}