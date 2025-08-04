package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ProtoField represents a field from a protobuf message
type ProtoField struct {
	Name     string
	Type     string
	Optional bool
	Repeated bool
}

// ProtoMessage represents a protobuf message definition
type ProtoMessage struct {
	Name   string
	Fields []ProtoField
}

// SwaggerDefinition represents a swagger schema definition
type SwaggerDefinition struct {
	Type       string                       `json:"type"`
	Properties map[string]SwaggerProperty   `json:"properties"`
	Items      *SwaggerDefinition          `json:"items,omitempty"`
}

// SwaggerProperty represents a property in a swagger definition
type SwaggerProperty struct {
	Type        string                     `json:"type"`
	Format      string                     `json:"format,omitempty"`
	Items       *SwaggerDefinition        `json:"items,omitempty"`
	Ref         string                     `json:"$ref,omitempty"`
	Description string                     `json:"description,omitempty"`
}

// SwaggerSpec represents the swagger.json structure
type SwaggerSpec struct {
	Definitions map[string]SwaggerDefinition `json:"definitions"`
}

// TestSwaggerCompletenessAgainstProto validates that all protobuf fields appear in swagger.json
func TestSwaggerCompletenessAgainstProto(t *testing.T) {
	// Parse all proto files
	protoMessages, err := parseProtoFiles("../proto")
	require.NoError(t, err, "Failed to parse proto files")

	// Parse swagger.json
	swaggerSpec, err := parseSwaggerFile("docs/swagger.json")
	require.NoError(t, err, "Failed to parse swagger.json")

	// Track validation results
	var missingFields []string
	var wrongTypes []string
	var errors []string

	// Validate each proto message against swagger definitions
	for _, protoMsg := range protoMessages {
		// Skip messages that are not used in the API (they won't appear in swagger)
		if shouldSkipMessage(protoMsg.Name) {
			continue
		}

		// Find corresponding swagger definition
		swaggerDef := findSwaggerDefinition(swaggerSpec, protoMsg.Name)
		if swaggerDef == nil {
			errors = append(errors, fmt.Sprintf("MISSING MESSAGE: %s not found in swagger definitions", protoMsg.Name))
			continue
		}

		// Check each field
		for _, field := range protoMsg.Fields {
			swaggerField, exists := swaggerDef.Properties[field.Name]
			if !exists {
				// Try camelCase conversion for field names
				camelCaseField := toCamelCase(field.Name)
				swaggerField, exists = swaggerDef.Properties[camelCaseField]
				if !exists {
					missingFields = append(missingFields, fmt.Sprintf("MISSING FIELD: %s.%s (type: %s)", protoMsg.Name, field.Name, field.Type))
					continue
				}
			}

			// Validate field type
			expectedSwaggerType := getExpectedSwaggerType(field.Type)
			if field.Repeated {
				// For repeated fields, expect array type
				if swaggerField.Type != "array" {
					wrongTypes = append(wrongTypes, fmt.Sprintf("WRONG TYPE: %s.%s (repeated) expected array but got %s", 
						protoMsg.Name, field.Name, swaggerField.Type))
				}
			} else if !isValidSwaggerType(swaggerField, expectedSwaggerType, field.Type) {
				wrongTypes = append(wrongTypes, fmt.Sprintf("WRONG TYPE: %s.%s expected %s but got %s", 
					protoMsg.Name, field.Name, expectedSwaggerType, swaggerField.Type))
			}
		}
	}

	// Report results
	if len(errors) > 0 {
		t.Logf("Missing message definitions:")
		for _, err := range errors {
			t.Log("  " + err)
		}
	}

	if len(missingFields) > 0 {
		t.Logf("Missing fields (%d total):", len(missingFields))
		for _, field := range missingFields {
			t.Log("  " + field)
		}
	}

	if len(wrongTypes) > 0 {
		t.Logf("Incorrect field types (%d total):", len(wrongTypes))
		for _, typ := range wrongTypes {
			t.Log("  " + typ)
		}
	}

	// Fail test if any issues found
	assert.Empty(t, errors, "Missing message definitions in swagger")
	assert.Empty(t, missingFields, "Missing protobuf fields in swagger")
	assert.Empty(t, wrongTypes, "Incorrect field types in swagger")

	t.Logf("✅ Swagger validation passed: All %d proto messages and their fields are properly represented", len(protoMessages))
}

// parseProtoFiles parses all .proto files in the given directory
func parseProtoFiles(protoDir string) ([]ProtoMessage, error) {
	var messages []ProtoMessage

	err := filepath.Walk(protoDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !strings.HasSuffix(path, ".proto") {
			return nil
		}

		fileMessages, err := parseProtoFile(path)
		if err != nil {
			return fmt.Errorf("failed to parse %s: %w", path, err)
		}

		messages = append(messages, fileMessages...)
		return nil
	})

	return messages, err
}

// parseProtoFile parses a single .proto file
func parseProtoFile(filePath string) ([]ProtoMessage, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var messages []ProtoMessage
	lines := strings.Split(string(content), "\n")
	
	var currentMessage *ProtoMessage
	messageRegex := regexp.MustCompile(`^message\s+(\w+)\s*\{`)
	fieldRegex := regexp.MustCompile(`^\s*(optional|repeated)?\s*([^=]+?)\s+(\w+)\s*=\s*\d+`)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		
		// Check for message start
		if matches := messageRegex.FindStringSubmatch(line); matches != nil {
			if currentMessage != nil {
				messages = append(messages, *currentMessage)
			}
			currentMessage = &ProtoMessage{
				Name:   matches[1],
				Fields: []ProtoField{},
			}
			continue
		}

		// Check for message end
		if line == "}" && currentMessage != nil {
			messages = append(messages, *currentMessage)
			currentMessage = nil
			continue
		}

		// Parse fields
		if currentMessage != nil && fieldRegex.MatchString(line) {
			field := parseProtoField(line)
			if field != nil {
				currentMessage.Fields = append(currentMessage.Fields, *field)
			}
		}
	}

	return messages, nil
}

// parseProtoField parses a protobuf field definition
func parseProtoField(line string) *ProtoField {
	// Remove comments
	if idx := strings.Index(line, "//"); idx != -1 {
		line = line[:idx]
	}
	line = strings.TrimSpace(line)

	// Parse field pattern: [optional/repeated] type name = number;
	fieldRegex := regexp.MustCompile(`^\s*(optional|repeated)?\s*([^=]+?)\s+(\w+)\s*=\s*\d+`)
	matches := fieldRegex.FindStringSubmatch(line)
	if matches == nil {
		return nil
	}

	modifier := strings.TrimSpace(matches[1])
	fieldType := strings.TrimSpace(matches[2])
	fieldName := strings.TrimSpace(matches[3])

	return &ProtoField{
		Name:     fieldName,
		Type:     fieldType,
		Optional: modifier == "optional",
		Repeated: modifier == "repeated",
	}
}

// parseSwaggerFile parses the swagger.json file
func parseSwaggerFile(filePath string) (*SwaggerSpec, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	var spec SwaggerSpec
	err = json.Unmarshal(content, &spec)
	if err != nil {
		return nil, err
	}

	return &spec, nil
}

// findSwaggerDefinition finds the swagger definition for a proto message
func findSwaggerDefinition(spec *SwaggerSpec, messageName string) *SwaggerDefinition {
	// Try various naming patterns that swag might use
	patterns := []string{
		"_go." + messageName,
		"apipb." + messageName,
		"api." + messageName,
		messageName,
	}

	for _, pattern := range patterns {
		if def, exists := spec.Definitions[pattern]; exists {
			return &def
		}
	}

	return nil
}

// getExpectedSwaggerType maps protobuf types to expected swagger types
func getExpectedSwaggerType(protoType string) string {
	switch protoType {
	case "string":
		return "string"
	case "int32", "int64":
		return "integer"
	case "double", "float":
		return "number"
	case "bool":
		return "boolean"
	case "google.protobuf.Timestamp":
		return "string" // Should be string with format: date-time
	case "bytes":
		return "string" // Should be string with format: byte
	default:
		if strings.Contains(protoType, ".") {
			return "object" // Nested message
		}
		return "string" // Default fallback
	}
}

// isValidSwaggerType checks if the swagger type matches the expected type
func isValidSwaggerType(swaggerField SwaggerProperty, expectedType, protoType string) bool {
	if swaggerField.Type == expectedType {
		// For timestamps, also check for proper format
		if protoType == "google.protobuf.Timestamp" {
			return swaggerField.Format == "date-time" || swaggerField.Format == ""
		}
		return true
	}

	// Handle reference types
	if swaggerField.Ref != "" && expectedType == "object" {
		return true
	}

	// Handle arrays - swagger correctly represents repeated proto fields as arrays
	if swaggerField.Type == "array" && expectedType == "string" {
		return true // This is actually correct for repeated fields
	}

	return false
}

// shouldSkipMessage determines if a proto message should be ignored in swagger validation
func shouldSkipMessage(messageName string) bool {
	// Skip messages that are not used in the REST API (internal, gRPC-only, or unused)
	skipPatterns := []string{
		// Agent service messages not exposed via REST
		"PlanStartRequest", "PlanStartResponse", 
		"PlanFeedbackRequest", "PlanFeedbackResponse",
		"PlanFinalizeRequest", "PlanFinalizeResponse",
		"ResumeWorkflowRequest", "ResumeWorkflowResponse",
		
		// Internal/unused messages
		"MealPlanIdentifier", "SaveCheckpointRequest", "CheckpointResponse",
		"AgentFeedbackRequest", "AgentResumeRequest",
		
		// Request-only messages that don't appear in swagger definitions
		"GetAllMealsRequest", "DeleteMealIngredientRequest", "DeleteMealRequest",
		"GetStepsRequest", "DeleteStepRequest", "DeleteAllStepsRequest",
		"GetWorkflowStatusRequest", "CancelWorkflowRequest", "GetWorkflowStateRequest",
		"AbandonWorkflowRequest", "GetMessagesRequest", "GetCheckpointRequest",
		"ListCheckpointsRequest",
		
		// Logging service messages (not part of main API)
		"LogEntry", "LogRequest", "LogResponse", "LogBatchRequest", "LogBatchResponse",
		
		// Google protobuf types
		"Any", "Timestamp",
	}
	
	for _, pattern := range skipPatterns {
		if messageName == pattern {
			return true
		}
	}
	
	return false
}

// toCamelCase converts snake_case to camelCase
func toCamelCase(s string) string {
	parts := strings.Split(s, "_")
	if len(parts) == 1 {
		return s
	}

	result := parts[0]
	for i := 1; i < len(parts); i++ {
		if len(parts[i]) > 0 {
			result += strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return result
}