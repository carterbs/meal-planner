package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// ProtoField represents a field from a protobuf message
type ProtoField struct {
	Name         string
	Type         string
	Optional     bool
	Repeated     bool
	JsonName     string // The JSON field name (camelCase)
}

// ProtoMessage represents a protobuf message definition  
type ProtoMessage struct {
	Name   string
	Fields []ProtoField
}

// SwaggerProperty represents a property in a swagger definition
type SwaggerProperty struct {
	Type        string            `json:"type"`
	Format      string            `json:"format,omitempty"`
	Items       *SwaggerProperty  `json:"items,omitempty"`
	Ref         string            `json:"$ref,omitempty"`
	Description string            `json:"description,omitempty"`
}

// SwaggerDefinition represents a swagger schema definition
type SwaggerDefinition struct {
	Type       string                        `json:"type"`
	Properties map[string]SwaggerProperty    `json:"properties"`
	Items      *SwaggerProperty             `json:"items,omitempty"`
}

// SwaggerSpec represents the swagger.json structure
type SwaggerSpec struct {
	Definitions map[string]SwaggerDefinition `json:"definitions"`
	// Include other fields to preserve them during marshaling
	Swagger     string                   `json:"swagger"`
	Info        map[string]interface{}   `json:"info"`
	Host        string                   `json:"host"`
	BasePath    string                   `json:"basePath"`
	Paths       map[string]interface{}   `json:"paths"`
	Schemes     []string                 `json:"schemes,omitempty"`
}

func main() {
	var inputFile = flag.String("input", "", "Input swagger.json file")
	var outputFile = flag.String("output", "", "Output swagger.json file")
	var protoDir = flag.String("proto-dir", "../proto", "Directory containing .proto files")
	flag.Parse()

	if *inputFile == "" || *outputFile == "" {
		log.Fatal("Usage: swagger-fix -input swagger.json -output swagger.json [-proto-dir ../proto]")
	}

	log.Printf("Fixing swagger fields from protobuf definitions...")
	log.Printf("Input: %s", *inputFile)
	log.Printf("Output: %s", *outputFile)
	log.Printf("Proto dir: %s", *protoDir)

	// Parse protobuf files
	protoMessages, err := parseProtoFiles(*protoDir)
	if err != nil {
		log.Fatal("Error parsing proto files:", err)
	}
	log.Printf("Parsed %d protobuf messages", len(protoMessages))

	// Parse swagger.json
	swaggerSpec, err := parseSwaggerFile(*inputFile)
	if err != nil {
		log.Fatal("Error parsing swagger file:", err)
	}
	log.Printf("Parsed swagger with %d definitions", len(swaggerSpec.Definitions))

	// Fix missing protobuf fields
	fixed := 0
	for _, protoMsg := range protoMessages {
		if fixSwaggerDefinition(swaggerSpec, protoMsg) {
			fixed++
		}
	}

	log.Printf("Fixed %d swagger definitions", fixed)

	// Write updated swagger.json
	if err := writeSwaggerFile(*outputFile, swaggerSpec); err != nil {
		log.Fatal("Error writing swagger file:", err)
	}

	log.Printf("Successfully updated swagger.json")
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
	// Remove comments but preserve json_name option
	originalLine := line
	if idx := strings.Index(line, "//"); idx != -1 {
		line = line[:idx]
	}
	line = strings.TrimSpace(line)

	// Parse field pattern: [optional/repeated] type name = number [options];
	fieldRegex := regexp.MustCompile(`^\s*(optional|repeated)?\s*([^=]+?)\s+(\w+)\s*=\s*\d+`)
	matches := fieldRegex.FindStringSubmatch(line)
	if matches == nil {
		return nil
	}

	modifier := strings.TrimSpace(matches[1])
	fieldType := strings.TrimSpace(matches[2])
	fieldName := strings.TrimSpace(matches[3])

	// Extract json_name from options if present
	jsonName := fieldName
	jsonNameRegex := regexp.MustCompile(`json_name\s*=\s*"([^"]+)"`)
	if jsonMatches := jsonNameRegex.FindStringSubmatch(originalLine); jsonMatches != nil {
		jsonName = jsonMatches[1]
	} else {
		// Convert snake_case to camelCase by default
		jsonName = toCamelCase(fieldName)
	}

	return &ProtoField{
		Name:     fieldName,
		Type:     fieldType,
		Optional: modifier == "optional",
		Repeated: modifier == "repeated",
		JsonName: jsonName,
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

// writeSwaggerFile writes the swagger spec to a file
func writeSwaggerFile(filePath string, spec *SwaggerSpec) error {
	content, err := json.MarshalIndent(spec, "", "    ")
	if err != nil {
		return err
	}

	return os.WriteFile(filePath, content, 0644)
}

// fixSwaggerDefinition fixes missing protobuf fields in a swagger definition
func fixSwaggerDefinition(spec *SwaggerSpec, protoMsg ProtoMessage) bool {
	// Find corresponding swagger definition
	swaggerDef := findSwaggerDefinition(spec, protoMsg.Name)
	if swaggerDef == nil {
		return false
	}

	fixed := false

	// Check and fix each field
	for _, field := range protoMsg.Fields {
		jsonFieldName := field.JsonName

		// Check if field exists in swagger definition
		if _, exists := swaggerDef.Properties[jsonFieldName]; !exists {
			// Add missing field
			swaggerProperty := createSwaggerProperty(field)
			swaggerDef.Properties[jsonFieldName] = swaggerProperty
			log.Printf("Added missing field: %s.%s (type: %s)", protoMsg.Name, jsonFieldName, field.Type)
			fixed = true
		} else {
			// Check if existing field needs type correction
			existingProp := swaggerDef.Properties[jsonFieldName]
			expectedProp := createSwaggerProperty(field)
			
			if needsTypeCorrection(existingProp, expectedProp, field.Type) {
				swaggerDef.Properties[jsonFieldName] = expectedProp
				log.Printf("Fixed field type: %s.%s (%s -> %s)", protoMsg.Name, jsonFieldName, existingProp.Type, expectedProp.Type)
				fixed = true
			}
		}
	}

	return fixed
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

// createSwaggerProperty creates a swagger property from a protobuf field
func createSwaggerProperty(field ProtoField) SwaggerProperty {
	prop := SwaggerProperty{}

	if field.Repeated {
		// Array field
		prop.Type = "array"
		prop.Items = &SwaggerProperty{
			Type: getSwaggerType(field.Type),
		}
		
		// Set format for timestamp arrays
		if field.Type == "google.protobuf.Timestamp" {
			prop.Items.Format = "date-time"
		}
	} else {
		// Single field
		prop.Type = getSwaggerType(field.Type)
		
		// Set format for timestamps
		if field.Type == "google.protobuf.Timestamp" {
			prop.Format = "date-time"
			prop.Description = "RFC3339 timestamp"
		}
		
		// Handle nested message types
		if strings.Contains(field.Type, ".") && field.Type != "google.protobuf.Timestamp" {
			prop.Ref = "#/definitions/_go." + extractMessageName(field.Type)
			prop.Type = "" // Clear type when using $ref
		}
	}

	return prop
}

// getSwaggerType maps protobuf types to swagger types
func getSwaggerType(protoType string) string {
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
		return "string"
	case "bytes":
		return "string"
	default:
		if strings.Contains(protoType, ".") {
			return "object" // Will use $ref instead
		}
		return "string" // Default fallback
	}
}

// extractMessageName extracts the message name from a qualified type
func extractMessageName(qualifiedType string) string {
	parts := strings.Split(qualifiedType, ".")
	return parts[len(parts)-1]
}

// needsTypeCorrection checks if an existing swagger property needs correction
func needsTypeCorrection(existing, expected SwaggerProperty, protoType string) bool {
	// Check for missing timestamp fields (empty type with timestamp proto type)
	if protoType == "google.protobuf.Timestamp" && existing.Type == "" {
		return true
	}
	
	// Check for type mismatches
	if existing.Type != expected.Type {
		return true
	}
	
	// Check for missing format on timestamps
	if protoType == "google.protobuf.Timestamp" && existing.Format != "date-time" {
		return true
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