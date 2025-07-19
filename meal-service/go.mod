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
	github.com/go-chi/chi/v5 v5.2.2
	github.com/stretchr/testify v1.10.0
	github.com/swaggo/swag v1.16.5
	go.uber.org/zap v1.26.0
	google.golang.org/grpc v1.73.0
	google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1
	google.golang.org/protobuf v1.36.6
	logging-service/client/go v0.0.0-00010101000000-000000000000
)

require (
	github.com/KyleBanks/depth v1.2.1 // indirect
	github.com/PuerkitoBio/purell v1.1.1 // indirect
	github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.0-20190314233015-f79a8a8ca69d // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/go-openapi/jsonpointer v0.19.5 // indirect
	github.com/go-openapi/jsonreference v0.19.6 // indirect
	github.com/go-openapi/spec v0.20.4 // indirect
	github.com/go-openapi/swag v0.19.15 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/mailru/easyjson v0.7.6 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/russross/blackfriday/v2 v2.0.1 // indirect
	github.com/shurcooL/sanitized_anchor_name v1.0.0 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/urfave/cli/v2 v2.3.0 // indirect
	go.uber.org/multierr v1.10.0 // indirect
	golang.org/x/mod v0.17.0 // indirect
	golang.org/x/net v0.38.0 // indirect
	golang.org/x/sys v0.31.0 // indirect
	golang.org/x/text v0.23.0 // indirect
	golang.org/x/tools v0.21.1-0.20240508182429-e35e4ccd0d2d // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250324211829-b45e905df463 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	sigs.k8s.io/yaml v1.3.0 // indirect
)
