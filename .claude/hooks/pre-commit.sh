#!/usr/bin/env bash
set -euo pipefail

echo "Pre-commit: running check:fast..."
cd "$(git rev-parse --show-toplevel)"
pnpm run check:fast

echo "Pre-commit: check:fast passed."
