package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
)

// snakeToCamelCase converts snake_case to camelCase
func snakeToCamelCase(s string) string {
	parts := strings.Split(s, "_")
	for i := 1; i < len(parts); i++ {
		if len(parts[i]) > 0 {
			parts[i] = strings.ToUpper(string(parts[i][0])) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}

// isSnakeCase checks if a string is in snake_case format
func isSnakeCase(s string) bool {
	return strings.Contains(s, "_")
}

// transformProperties recursively transforms all property names from snake_case to camelCase
func transformProperties(data interface{}) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		// Special handling for properties objects in definitions
		if props, ok := v["properties"].(map[string]interface{}); ok {
			newProps := make(map[string]interface{})
			for propName, propValue := range props {
				newName := propName
				if isSnakeCase(propName) {
					newName = snakeToCamelCase(propName)
				}
				newProps[newName] = transformProperties(propValue)
			}
			v["properties"] = newProps
		}

		// Recursively transform all other map values
		for key, value := range v {
			if key != "properties" {
				v[key] = transformProperties(value)
			}
		}
		return v

	case []interface{}:
		// Transform array elements
		for i, item := range v {
			v[i] = transformProperties(item)
		}
		return v

	default:
		// Return as-is for primitive types
		return v
	}
}

func main() {
	// Parse command line flags
	inputFile := flag.String("input", "", "Input swagger.json file path")
	outputFile := flag.String("output", "", "Output swagger.json file path")
	flag.Parse()

	if *inputFile == "" || *outputFile == "" {
		fmt.Println("Usage: swagger-transform -input <input.json> -output <output.json>")
		os.Exit(1)
	}

	// Read the input file
	data, err := ioutil.ReadFile(*inputFile)
	if err != nil {
		fmt.Printf("Error reading input file: %v\n", err)
		os.Exit(1)
	}

	// Parse JSON
	var swagger map[string]interface{}
	if err := json.Unmarshal(data, &swagger); err != nil {
		fmt.Printf("Error parsing JSON: %v\n", err)
		os.Exit(1)
	}

	// Transform definitions
	if definitions, ok := swagger["definitions"].(map[string]interface{}); ok {
		swagger["definitions"] = transformProperties(definitions)
	}

	// Also transform request/response references in paths if needed
	// This ensures consistency between definitions and usage

	// Marshal back to JSON with proper formatting
	output, err := json.MarshalIndent(swagger, "", "    ")
	if err != nil {
		fmt.Printf("Error marshaling JSON: %v\n", err)
		os.Exit(1)
	}

	// Write to output file
	if err := ioutil.WriteFile(*outputFile, output, 0644); err != nil {
		fmt.Printf("Error writing output file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Successfully transformed %s → %s\n", *inputFile, *outputFile)
}