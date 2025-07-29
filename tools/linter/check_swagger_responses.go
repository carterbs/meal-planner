package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Violation represents a linting violation
type Violation struct {
	File    string
	Line    int
	Column  int
	Message string
}

var violations []Violation

// Regular expression to match @Success annotations
var successRegex = regexp.MustCompile(`@Success\s+\d+\s+\{(\w+)\}\s+(\S+)`)

// Regular expression to match snake_case in json tags
var snakeCaseRegex = regexp.MustCompile(`json:"([^"]*_[^"]*)"`)

// checkSwaggerAnnotations checks a file for Swagger @Success annotations with non-proto types
func checkSwaggerAnnotations(filename string, src []byte) {
	lines := strings.Split(string(src), "\n")
	
	for lineNum, line := range lines {
		// Check for @Success annotations
		if matches := successRegex.FindStringSubmatch(line); len(matches) > 0 {
			responseType := matches[2]
			
			// Check if the response type is not a proto message type
			if !isProtoType(responseType) && responseType != "binary" {
				violations = append(violations, Violation{
					File:    filename,
					Line:    lineNum + 1,
					Column:  strings.Index(line, responseType) + 1,
					Message: fmt.Sprintf("@Success annotation uses non-proto type: %s", responseType),
				})
			}
		}
	}
}

// isProtoType checks if a type is a protobuf message type
func isProtoType(typeName string) bool {
	// Remove any quotes if present
	typeName = strings.Trim(typeName, `"`)
	
	// Check for common proto type patterns
	return strings.Contains(typeName, "pb.") || 
		strings.Contains(typeName, "apipb.") ||
		strings.Contains(typeName, "agentpb.") ||
		strings.HasSuffix(typeName, "Response") && strings.Contains(typeName, ".")
}

// checkStructDefinitions checks for struct definitions with snake_case json tags
func checkStructDefinitions(filename string, src []byte) error {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filename, src, parser.ParseComments)
	if err != nil {
		return fmt.Errorf("failed to parse %s: %v", filename, err)
	}
	
	ast.Inspect(file, func(n ast.Node) bool {
		// Look for struct type definitions
		typeSpec, ok := n.(*ast.TypeSpec)
		if !ok {
			return true
		}
		
		structType, ok := typeSpec.Type.(*ast.StructType)
		if !ok {
			return true
		}
		
		// Check each field in the struct
		for _, field := range structType.Fields.List {
			if field.Tag != nil {
				tag := strings.Trim(field.Tag.Value, "`")
				
				// Check for snake_case in json tags
				if matches := snakeCaseRegex.FindStringSubmatch(tag); len(matches) > 0 {
					pos := fset.Position(field.Tag.Pos())
					violations = append(violations, Violation{
						File:    filename,
						Line:    pos.Line,
						Column:  pos.Column,
						Message: fmt.Sprintf("struct field uses snake_case in json tag: %s", matches[0]),
					})
				}
			}
		}
		
		return true
	})
	
	return nil
}

// processFile processes a single Go file
func processFile(path string) error {
	src, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read %s: %v", path, err)
	}
	
	// Check Swagger annotations
	checkSwaggerAnnotations(path, src)
	
	// Check struct definitions
	if err := checkStructDefinitions(path, src); err != nil {
		return err
	}
	
	return nil
}

// walkDirectory walks through the api-gateway directory and processes Go files
func walkDirectory(root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		// Skip directories and non-Go files
		if info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		
		// Skip vendor and generated files
		if strings.Contains(path, "/vendor/") || strings.Contains(path, ".pb.go") {
			return nil
		}
		
		fmt.Printf("Checking %s\n", path)
		if err := processFile(path); err != nil {
			fmt.Fprintf(os.Stderr, "Error processing %s: %v\n", path, err)
		}
		
		return nil
	})
}

func main() {
	// Determine the api-gateway directory
	apiGatewayDir := "./api-gateway"
	if len(os.Args) > 1 {
		apiGatewayDir = os.Args[1]
	}
	
	// Check if directory exists
	if _, err := os.Stat(apiGatewayDir); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: api-gateway directory not found: %s\n", apiGatewayDir)
		os.Exit(1)
	}
	
	fmt.Printf("Linting Swagger annotations in %s\n", apiGatewayDir)
	fmt.Println("=" + strings.Repeat("=", 50))
	
	// Walk the directory and process files
	if err := walkDirectory(apiGatewayDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error walking directory: %v\n", err)
		os.Exit(1)
	}
	
	// Report violations
	if len(violations) > 0 {
		fmt.Printf("\nFound %d violation(s):\n", len(violations))
		fmt.Println("-" + strings.Repeat("-", 50))
		
		for _, v := range violations {
			fmt.Printf("%s:%d:%d: %s\n", v.File, v.Line, v.Column, v.Message)
		}
		
		fmt.Println("\nLinting failed!")
		os.Exit(1)
	} else {
		fmt.Println("\nNo violations found. All Swagger annotations use proto types!")
		os.Exit(0)
	}
}