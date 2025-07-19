#!/usr/bin/env bash
set -euo pipefail

export CODEX_ENV_PYTHON_VERSION=3.13
export CODEX_ENV_NODE_VERSION=22
export CODEX_ENV_GO_VERSION=22
# --- Project–specific dependencies ----------------------------
yarn install
pushd typescript
yarn install
popd

pushd meal-service
go mod download
popd