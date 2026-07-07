#!/usr/bin/env bash
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

changed_paths="$(
  {
    git diff --name-only --diff-filter=ACMR main...HEAD 2>/dev/null || true
    git diff --name-only --diff-filter=ACMR
    git diff --cached --name-only --diff-filter=ACMR
    git ls-files --others --exclude-standard
  } | sort -u
)"

if ! printf '%s\n' "$changed_paths" | grep -Eq '(^|/)[^/]+\.test\.ts$|(^|/)[^/]+\.property\.test\.ts$|^tests/.*\.ts$|^tests/e2e/.*\.spec\.ts$'; then
  exit 0
fi

pnpm run check:test-quality
