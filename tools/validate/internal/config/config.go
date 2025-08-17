// Package config handles loading and validation of .validate.yaml configuration files.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Config represents the root configuration structure.
type Config struct {
	Services []Service `yaml:"services"`
}

// Service represents a service configuration.
type Service struct {
	Name string      `yaml:"name"`
	Type ServiceType `yaml:"type"`
	Dir  string      `yaml:"dir,omitempty"`
	Test interface{} `yaml:"test,omitempty"`
	Lint interface{} `yaml:"lint,omitempty"`
	Build interface{} `yaml:"build,omitempty"`
	MinCoverage int  `yaml:"min_coverage,omitempty"`
}

// ServiceType represents the type of service (go or node).
type ServiceType string

const (
	ServiceTypeGo   ServiceType = "go"
	ServiceTypeNode ServiceType = "node"
)

// Command represents a command configuration.
type Command struct {
	Cmd             string `yaml:"cmd,omitempty"`
	CoverageProfile string `yaml:"coverage_profile,omitempty"`
}

// Loader handles loading configuration files.
type Loader struct {
	configPath string
}

// NewLoader creates a new config loader.
func NewLoader(configPath string) *Loader {
	return &Loader{configPath: configPath}
}

// Load loads and validates the configuration from the specified path.
func (l *Loader) Load() (*Config, error) {
	configPath := l.configPath
	if configPath == "" {
		configPath = ".validate.yaml"
	}
	
	// Make path absolute if it's relative
	if !filepath.IsAbs(configPath) {
		wd, err := os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("failed to get working directory: %w", err)
		}
		configPath = filepath.Join(wd, configPath)
	}
	
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file %s: %w", configPath, err)
	}
	
	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file %s: %w", configPath, err)
	}
	
	if err := l.validateConfig(&config); err != nil {
		return nil, fmt.Errorf("invalid config in %s: %w", configPath, err)
	}
	
	return &config, nil
}

// validateConfig validates the loaded configuration.
func (l *Loader) validateConfig(config *Config) error {
	if len(config.Services) == 0 {
		return fmt.Errorf("no services defined")
	}
	
	serviceNames := make(map[string]bool)
	for i, service := range config.Services {
		if service.Name == "" {
			return fmt.Errorf("service at index %d has no name", i)
		}
		
		if serviceNames[service.Name] {
			return fmt.Errorf("duplicate service name: %s", service.Name)
		}
		serviceNames[service.Name] = true
		
		if service.Type != ServiceTypeGo && service.Type != ServiceTypeNode {
			return fmt.Errorf("service %s has invalid type %q, must be 'go' or 'node'", service.Name, service.Type)
		}
		
		// Validate that at least one command is defined
		testCmd := service.GetTestCommand()
		lintCmd := service.GetLintCommand()
		buildCmd := service.GetBuildCommand()
		
		if testCmd == "" && lintCmd == "" && buildCmd == "" {
			return fmt.Errorf("service %s has no commands defined", service.Name)
		}
		
		// For Go services, validate directory if specified
		if service.Type == ServiceTypeGo && service.Dir != "" {
			if !filepath.IsAbs(service.Dir) && !isRelativePath(service.Dir) {
				return fmt.Errorf("service %s has invalid directory path: %s", service.Name, service.Dir)
			}
		}
		
		// Validate coverage percentage
		if service.MinCoverage < 0 || service.MinCoverage > 100 {
			return fmt.Errorf("service %s has invalid min_coverage %d, must be between 0 and 100", service.Name, service.MinCoverage)
		}
	}
	
	return nil
}

// isRelativePath checks if a path is a valid relative path.
func isRelativePath(path string) bool {
	if path == "." || path == ".." {
		return true
	}
	if len(path) > 1 && path[0] == '.' && (path[1] == filepath.Separator || path[1] == '/') {
		return true
	}
	if len(path) > 2 && path[0] == '.' && path[1] == '.' && (path[2] == filepath.Separator || path[2] == '/') {
		return true
	}
	return false
}

// GetTestCommand returns the test command as a string.
func (s *Service) GetTestCommand() string {
	return s.getCommandString(s.Test)
}

// GetLintCommand returns the lint command as a string.
func (s *Service) GetLintCommand() string {
	return s.getCommandString(s.Lint)
}

// GetBuildCommand returns the build command as a string.
func (s *Service) GetBuildCommand() string {
	return s.getCommandString(s.Build)
}

// GetTestCommandStruct returns the test command as a Command struct.
func (s *Service) GetTestCommandStruct() Command {
	return s.getCommandStruct(s.Test)
}

// GetLintCommandStruct returns the lint command as a Command struct.
func (s *Service) GetLintCommandStruct() Command {
	return s.getCommandStruct(s.Lint)
}

// GetBuildCommandStruct returns the build command as a Command struct.
func (s *Service) GetBuildCommandStruct() Command {
	return s.getCommandStruct(s.Build)
}

// getCommandString extracts the command string from either a string or Command struct.
func (s *Service) getCommandString(cmd interface{}) string {
	if cmd == nil {
		return ""
	}
	
	switch v := cmd.(type) {
	case string:
		return v
	case map[string]interface{}:
		if cmdStr, ok := v["cmd"].(string); ok {
			return cmdStr
		}
	case Command:
		return v.Cmd
	}
	
	return ""
}

// getCommandStruct extracts a Command struct from either a string or Command struct.
func (s *Service) getCommandStruct(cmd interface{}) Command {
	if cmd == nil {
		return Command{}
	}
	
	switch v := cmd.(type) {
	case string:
		return Command{Cmd: v}
	case map[string]interface{}:
		result := Command{}
		if cmdStr, ok := v["cmd"].(string); ok {
			result.Cmd = cmdStr
		}
		if profile, ok := v["coverage_profile"].(string); ok {
			result.CoverageProfile = profile
		}
		return result
	case Command:
		return v
	}
	
	return Command{}
}

// GetService returns the service with the given name, or nil if not found.
func (c *Config) GetService(name string) *Service {
	for i := range c.Services {
		if c.Services[i].Name == name {
			return &c.Services[i]
		}
	}
	return nil
}

// ServiceNames returns a slice of all service names.
func (c *Config) ServiceNames() []string {
	names := make([]string, len(c.Services))
	for i, service := range c.Services {
		names[i] = service.Name
	}
	return names
}

// FilterServices returns a new config with only the specified services.
func (c *Config) FilterServices(names []string) *Config {
	if len(names) == 0 {
		return c
	}
	
	nameSet := make(map[string]bool)
	for _, name := range names {
		nameSet[name] = true
	}
	
	filtered := &Config{}
	for _, service := range c.Services {
		if nameSet[service.Name] {
			filtered.Services = append(filtered.Services, service)
		}
	}
	
	return filtered
}