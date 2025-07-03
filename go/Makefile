# backend/Makefile

.PHONY: test coverage coverage-html clean

# Run all tests
 test:
	go test ./...

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