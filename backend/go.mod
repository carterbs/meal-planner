module mealplanner

go 1.23.0

toolchain go1.24.4

replace mealplanner/generated/go => ../generated/go

replace logging-service/client/go => ../logging-service/client/go

require (
	github.com/DATA-DOG/go-sqlmock v1.5.2
	github.com/joho/godotenv v1.5.1
	github.com/lib/pq v1.10.7
	mealplanner/generated/go v0.0.0-00010101000000-000000000000
)

require (
	github.com/fatih/color v1.18.0
	go.uber.org/zap v1.26.0
	google.golang.org/grpc v1.73.0
	google.golang.org/protobuf v1.36.6
	logging-service/client/go v0.0.0-00010101000000-000000000000
)

require (
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/stretchr/testify v1.10.0 // indirect
	go.uber.org/multierr v1.10.0 // indirect
	golang.org/x/net v0.38.0 // indirect
	golang.org/x/sys v0.31.0 // indirect
	golang.org/x/text v0.23.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250324211829-b45e905df463 // indirect
)
