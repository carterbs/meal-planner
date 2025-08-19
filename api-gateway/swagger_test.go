package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// TestSwaggerProtoConsistency validates that all protobuf fields are represented in swagger.json
func TestSwaggerProtoConsistency(t *testing.T) {
	// Load swagger.json
	swaggerPath := filepath.Join("docs", "swagger.json")
	swaggerData, err := ioutil.ReadFile(swaggerPath)
	if err != nil {
		t.Fatalf("Failed to read swagger.json: %v", err)
	}

	var swagger map[string]interface{}
	if err := json.Unmarshal(swaggerData, &swagger); err != nil {
		t.Fatalf("Failed to parse swagger.json: %v", err)
	}

	// Get swagger definitions
	definitions, ok := swagger["definitions"].(map[string]interface{})
	if !ok {
		t.Fatal("No definitions found in swagger.json")
	}

	// Parse main.go to find all swagger annotations
	mainPath := "main.go"
	mainContent, err := ioutil.ReadFile(mainPath)
	if err != nil {
		t.Fatalf("Failed to read main.go: %v", err)
	}

	// Find all request/response types referenced in swagger annotations
	referencedTypes := extractSwaggerTypes(string(mainContent))

	// Check that all referenced proto types exist in swagger definitions
	missingTypes := []string{}
	for typeName := range referencedTypes {
		// Skip non-proto types
		if !strings.HasPrefix(typeName, "apipb.") {
			continue
		}

		// Convert apipb.TypeName to _go.TypeName
		swaggerTypeName := strings.Replace(typeName, "apipb.", "_go.", 1)
		
		if _, exists := definitions[swaggerTypeName]; !exists {
			missingTypes = append(missingTypes, fmt.Sprintf("%s (expected as %s)", typeName, swaggerTypeName))
		}
	}

	if len(missingTypes) > 0 {
		t.Errorf("Missing proto types referenced in swagger annotations:\n%s", strings.Join(missingTypes, "\n"))
	}

	// Validate timestamp fields
	validateTimestampFields(t, definitions)
}

// extractSwaggerTypes finds all types referenced in swagger annotations
func extractSwaggerTypes(content string) map[string]bool {
	types := make(map[string]bool)

	// Regular expressions to match swagger annotations
	patterns := []string{
		`@Param\s+\w+\s+\w+\s+(\S+)`,           // @Param request body apipb.Response
		`@Success\s+\d+\s+\{object\}\s+(\S+)`, // @Success 200 {object} apipb.Response
		`@Failure\s+\d+\s+\{object\}\s+(\S+)`, // @Failure 400 {object} apipb.Response
		`@Param.*\{object\}\s+(\S+)`,          // Other param patterns
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindAllStringSubmatch(content, -1)
		for _, match := range matches {
			if len(match) > 1 {
				typeName := match[1]
				// Remove quotes if present
				typeName = strings.Trim(typeName, `"`)
				types[typeName] = true
			}
		}
	}

	return types
}

// validateTimestampFields ensures timestamp fields are properly represented
func validateTimestampFields(t *testing.T, definitions map[string]interface{}) {
	// Look for all types that have timestamp fields
	timestampFieldPattern := regexp.MustCompile(`(?i)(timestamp|created_at|updated_at|last_\w+ed)`)
	
	for typeName, def := range definitions {
		// Skip non-proto types
		if !strings.HasPrefix(typeName, "_go.") {
			continue
		}

		typeMap, ok := def.(map[string]interface{})
		if !ok {
			continue
		}

		properties, ok := typeMap["properties"].(map[string]interface{})
		if !ok {
			continue
		}

		// Check each field
		for fieldName, fieldDef := range properties {
			// If field name looks like a timestamp
			if timestampFieldPattern.MatchString(fieldName) {
				fieldMap, ok := fieldDef.(map[string]interface{})
				if !ok {
					continue
				}

				// Check if it's a reference to timestamppb.Timestamp
				ref, hasRef := fieldMap["$ref"].(string)
				fieldType, hasType := fieldMap["type"].(string)

				// If it has a type but not a ref, and the type is "string", 
				// it might be a timestamp that should use timestamppb.Timestamp
				if hasType && !hasRef && fieldType == "string" {
					// Check if it has format: date-time
					format, hasFormat := fieldMap["format"].(string)
					if hasFormat && format == "date-time" {
						t.Errorf("%s.%s is using string with date-time format instead of timestamppb.Timestamp", typeName, fieldName)
					}
				} else if hasRef && ref != "#/definitions/timestamppb.Timestamp" {
					// If it has a ref but it's not to timestamppb.Timestamp
					t.Errorf("%s.%s has timestamp-like name but references %s instead of timestamppb.Timestamp", typeName, fieldName, ref)
				}
			}
		}
	}
}

// TestSwaggerResponseTypesConsistency ensures all endpoint responses use proto types
func TestSwaggerResponseTypesConsistency(t *testing.T) {
	// Load swagger.json
	swaggerPath := filepath.Join("docs", "swagger.json")
	swaggerData, err := ioutil.ReadFile(swaggerPath)
	if err != nil {
		t.Fatalf("Failed to read swagger.json: %v", err)
	}

	var swagger map[string]interface{}
	if err := json.Unmarshal(swaggerData, &swagger); err != nil {
		t.Fatalf("Failed to parse swagger.json: %v", err)
	}

	// Get paths
	paths, ok := swagger["paths"].(map[string]interface{})
	if !ok {
		t.Fatal("No paths found in swagger.json")
	}

	// Check all endpoints
	invalidResponses := []string{}
	for path, pathData := range paths {
		pathMap, ok := pathData.(map[string]interface{})
		if !ok {
			continue
		}

		for method, methodData := range pathMap {
			methodMap, ok := methodData.(map[string]interface{})
			if !ok {
				continue
			}

			responses, ok := methodMap["responses"].(map[string]interface{})
			if !ok {
				continue
			}

			for statusCode, responseData := range responses {
				responseMap, ok := responseData.(map[string]interface{})
				if !ok {
					continue
				}

				schema, ok := responseMap["schema"].(map[string]interface{})
				if !ok {
					continue
				}

				ref, ok := schema["$ref"].(string)
				if !ok {
					continue
				}

				// Skip error responses
				if strings.Contains(ref, "ErrorResponse") {
					continue
				}

				// All non-error responses should reference _go. types
				if !strings.Contains(ref, "_go.") && !strings.Contains(ref, "timestamppb.") {
					invalidResponses = append(invalidResponses, fmt.Sprintf("%s %s (%s): %s", method, path, statusCode, ref))
				}
			}
		}
	}

	if len(invalidResponses) > 0 {
		t.Errorf("Endpoints using non-proto response types:\n%s", strings.Join(invalidResponses, "\n"))
	}
}

// TestNoOrphanedCustomTypes ensures we don't have custom types defined that aren't used
func TestNoOrphanedCustomTypes(t *testing.T) {
	// Parse main.go to find type definitions
	mainPath := "main.go"
	mainContent, err := ioutil.ReadFile(mainPath)
	if err != nil {
		t.Fatalf("Failed to read main.go: %v", err)
	}

	// Find all custom type definitions (excluding ErrorResponse)
	typeDefPattern := regexp.MustCompile(`type\s+([A-Z]\w*)\s+struct`)
	matches := typeDefPattern.FindAllStringSubmatch(string(mainContent), -1)

	customTypes := []string{}
	for _, match := range matches {
		if len(match) > 1 {
			typeName := match[1]
			// Skip ErrorResponse as it's legitimately needed
			if typeName != "ErrorResponse" && typeName != "Gateway" {
				customTypes = append(customTypes, typeName)
			}
		}
	}

	// If we find any custom response types, that's a problem
	suspiciousTypes := []string{}
	for _, typeName := range customTypes {
		if strings.HasSuffix(typeName, "Response") || 
		   strings.HasSuffix(typeName, "Request") ||
		   strings.HasSuffix(typeName, "Body") {
			suspiciousTypes = append(suspiciousTypes, typeName)
		}
	}

	if len(suspiciousTypes) > 0 {
		t.Errorf("Found custom request/response types that should probably use proto types instead:\n%s", 
			strings.Join(suspiciousTypes, "\n"))
	}
}