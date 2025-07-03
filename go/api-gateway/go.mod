module api-gateway

go 1.23.0

require (
	github.com/go-chi/chi/v5 v5.0.8
	github.com/go-chi/cors v1.2.1
	go.uber.org/zap v1.26.0
	google.golang.org/grpc v1.73.0
	mealplanner v0.0.0-00010101000000-000000000000
)

require (
	go.uber.org/multierr v1.10.0 // indirect
	golang.org/x/net v0.38.0 // indirect
	golang.org/x/sys v0.31.0 // indirect
	golang.org/x/text v0.23.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250324211829-b45e905df463 // indirect
	google.golang.org/protobuf v1.36.6 // indirect
)

replace mealplanner => ../
