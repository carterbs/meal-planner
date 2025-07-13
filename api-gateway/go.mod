module api-gateway

go 1.22

toolchain go1.24.4

replace logging-service/client/go => ../logging-service/client/go

replace mealplanner/generated/go => ../generated/go

require (
	github.com/go-chi/chi/v5 v5.1.0
	google.golang.org/grpc v1.69.2
	google.golang.org/protobuf v1.36.1
	logging-service/client/go v0.0.0-00010101000000-000000000000
	mealplanner/generated/go v0.0.0-00010101000000-000000000000
)

require (
	go.uber.org/multierr v1.10.0 // indirect
	go.uber.org/zap v1.26.0 // indirect
	golang.org/x/net v0.30.0 // indirect
	golang.org/x/sys v0.26.0 // indirect
	golang.org/x/text v0.19.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20241015192408-796eee8c2d53 // indirect
)
