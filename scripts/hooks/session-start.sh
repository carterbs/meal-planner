corepack enable
yarn set version berry
yarn install
pushd meal-service
    go mod download
    make tools
popd
pushd logging-service
    go mod download
popd
pushd api-gateway
    go mod download
popd

pushd tools/validate
    go mod download
    go build ./...
popd

./tools/validate/validate build

PB_REL="https://github.com/protocolbuffers/protobuf/releases"
curl -LO $PB_REL/download/v29.3/protoc-29.3-linux-x86_64.zip # Replace X.Y w29.3 desired version
unzip protoc-29.3-linux-x86_64.zip -d $HOME/.local

export PATH="$PATH:$HOME/.local/bin"

yarn generate_code