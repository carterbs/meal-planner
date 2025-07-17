#!/bin/bash

set -e
export PATH="$PATH:$HOME/go/bin:$(pwd)/.yarn/.bin"

./scripts/proto_gen.sh
./scripts/gateway-gen.sh
./scripts/ts-client-gen.sh
