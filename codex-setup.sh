#!/usr/bin/env bash
set -euo pipefail

export CODEX_ENV_PYTHON_VERSION=3.13
export CODEX_ENV_NODE_VERSION=22
export CODEX_ENV_GO_VERSION=22
# --- Project–specific dependencies ----------------------------
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

yarn generate_code
yarn workspace @meal-planner/shared build
yarn build:agent
yarn build:mcp