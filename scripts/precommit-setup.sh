#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_DIR="$ROOT_DIR/.git/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

mkdir -p "$HOOK_DIR"

cat > "$HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "Running UI lint and typecheck..."
# Run ESLint in quiet mode to treat warnings as non-blocking, then run typecheck
(cd ui && yarn run eslint src --ext .ts,.tsx --quiet && yarn run typecheck)
EOF

chmod +x "$HOOK_FILE"
echo "Pre-commit hook installed: $HOOK_FILE"


