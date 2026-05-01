# BUG: validation gate does not match the documented safety net

**Status:** Fixed
**Severity:** Medium
**Files:** `package.json`, `.github/workflows/test-validation.yml`, `packages/game-core/vitest.config.ts`, `scripts/audit-tests.ts`, `tests/integration/audit-tests.integration.test.ts`, `README.md`, `CONTRIBUTING.md`

## Description

The repo documents `pnpm run ci:verify` as the clean-room check that catches export-resolution issues, but the actual CI workflow only runs `pnpm validate`.

At the same time, `packages/game-core/vitest.config.ts` excludes `*.balance.test.ts`, so at least one real balance suite is outside the default validation gate even though the repo’s test-layer documentation presents balance as a first-class layer.

## Root Cause

- `check:exports` only runs through `ci:verify`, not `validate`
- GitHub Actions enforces `pnpm validate`, not `ci:verify`
- the audit helper reports test topology from filenames and layer suffixes rather than the active Vitest include/exclude configuration

## Impact

- contributors can believe exports and all documented layers are merge-blocking when they are not
- CI can pass while export-resolution issues or excluded suites remain outside the enforced gate
- audit output can overstate how much of the documented test topology is actually exercised by the main validation command

## Fix

- choose a canonical merge gate and wire the relevant checks into it
- document any intentionally separate suites as separate, not implicitly covered
- update the audit helper so it reflects actual Vitest discovery or clearly scopes itself as filename-topology analysis only

## Resolution

- `pnpm validate` now includes `check:exports`, which matches the CI workflow in `.github/workflows/test-validation.yml`
- `pnpm run ci:verify` is now documented as a separate clean-room export/test parity check instead of being described as the merge gate
- `scripts/audit-tests.ts` now reports both layer classification and whether a file is included in the default workspace Vitest run, and docs now call out separate balance suites explicitly
