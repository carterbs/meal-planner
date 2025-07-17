module api-gateway

go 1.23.0

toolchain go1.24.4

replace logging-service/client/go => ../logging-service/client/go

replace mealplanner/generated/go => ../generated/go

require (
	github.com/go-chi/chi/v5 v5.1.0
	github.com/swaggo/files v1.0.1
	github.com/swaggo/http-swagger v1.3.4
	google.golang.org/grpc v1.69.2
	google.golang.org/protobuf v1.36.1
	logging-service/client/go v0.0.0-00010101000000-000000000000
	mealplanner/generated/go v0.0.0-00010101000000-000000000000
)

require (
	github.com/KyleBanks/depth v1.2.1 // indirect
	github.com/go-openapi/jsonpointer v0.19.5 // indirect
	github.com/go-openapi/jsonreference v0.20.0 // indirect
	github.com/go-openapi/spec v0.20.6 // indirect
	github.com/go-openapi/swag v0.19.15 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/mailru/easyjson v0.7.6 // indirect
	github.com/stretchr/testify v1.10.0 // indirect
	github.com/swaggo/swag v1.8.1 // indirect
	go.uber.org/multierr v1.10.0 // indirect
	go.uber.org/zap v1.26.0 // indirect
	golang.org/x/net v0.42.0 // indirect
	golang.org/x/sys v0.34.0 // indirect
	golang.org/x/text v0.27.0 // indirect
	golang.org/x/tools v0.34.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20241015192408-796eee8c2d53 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
)
