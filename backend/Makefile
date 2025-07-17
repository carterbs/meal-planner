# backend/Makefile

.PHONY: test coverage coverage-html clean tools

# Install required code generation tools
tools:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/swaggo/swag/cmd/swag@latest

# Run all tests
test:
	go test ./... -v

# Generate coverage profile and display function-level coverage
coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out

# Open HTML coverage report
coverage-html:
	go tool cover -html=coverage.out

# Clean up generated files
clean:
	rm -f coverage.out 