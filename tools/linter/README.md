# Swagger Response Type Linter

This custom Go linter ensures that all Swagger annotations in the api-gateway use protobuf message types for responses and checks for snake_case naming in JSON tags.

## What it checks

1. **Swagger @Success annotations**: Ensures all `@Success` annotations reference protobuf message types (containing "pb." or "apipb.")
2. **JSON tag naming**: Detects struct fields with snake_case naming in JSON tags

## Usage

### Run on the api-gateway directory:
```bash
go run check_swagger_responses.go ../../api-gateway
```

### Run on a specific directory:
```bash
go run check_swagger_responses.go /path/to/directory
```

## Exit codes
- 0: No violations found
- 1: Violations found or error occurred

## Example violations

### Non-proto type in @Success annotation:
```go
// @Success 200 {object} MyCustomResponse "Success"  // ❌ Violation
// @Success 200 {object} apipb.GetMealResponse "Success"  // ✅ OK
```

### Snake_case in JSON tags:
```go
type User struct {
    FirstName string `json:"first_name"`  // ❌ Violation - uses snake_case
    LastName  string `json:"lastName"`   // ✅ OK - uses camelCase
}
```

## Integration

This linter can be integrated into CI/CD pipelines to enforce these standards:

```bash
# In your CI script
cd tools/linter
go run check_swagger_responses.go ../../api-gateway
if [ $? -ne 0 ]; then
    echo "Linting failed!"
    exit 1
fi
```