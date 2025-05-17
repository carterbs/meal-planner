#!/usr/bin/env bash
set -euo pipefail

export CODEX_ENV_PYTHON_VERSION=3.13.2
export CODEX_ENV_NODE_VERSION=22.1

# --- Project–specific dependencies ----------------------------
yarn install
pushd frontend
yarn install
popd

pushd frontend
yarn install
popd

pushd backend
go build
popd