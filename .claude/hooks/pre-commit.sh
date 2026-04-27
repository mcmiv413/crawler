#!/usr/bin/env bash
set -euo pipefail

echo "Pre-commit: running type check..."
cd "$(git rev-parse --show-toplevel)"
pnpm lint:types:all

echo "Pre-commit: type check passed."
