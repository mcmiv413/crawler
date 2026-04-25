# BUG: audit-tests script imports the advisor from the wrong path

**Status:** Fixed
**Severity:** Medium
**File:** `scripts/audit-tests.ts`

## Description

`scripts/audit-tests.ts` imports `./packages/game-core/src/testing/test-layer-advisor.js` from inside the `scripts/` directory. That resolves to `scripts/packages/...`, which does not exist, so the script fails immediately with `ERR_MODULE_NOT_FOUND`.

## Root Cause

The import path is written as though the script were executed from the repository root instead of from its own directory. The script therefore points at a non-existent relative path before any audit logic runs.

## Impact

- The repo's advertised test-audit helper is not runnable
- Audit sessions cannot rely on the script for fast test-layer triage
- Broken helper tooling makes the audit surface look healthier than it is
