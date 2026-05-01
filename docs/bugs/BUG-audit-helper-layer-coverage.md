# BUG: audit helper misses real test layers and file patterns

**Status:** Fixed
**Severity:** Medium
**Files:** `scripts/audit-tests.ts`, `tests/vitest.config.ts`

## Description

`scripts/audit-tests.ts` only discovers `*.test.ts` and `*.test.tsx`, then collapses `tests/e2e` and property tests into generic buckets. That misses real suites such as `tests/**/*.spec.ts` and misreports the repo's documented testing topology.

## Root Cause

The helper hardcodes a narrow discovery rule and outdated layer names instead of matching the file patterns and layer vocabulary already used by the repo's test configuration and testing guide.

## Impact

- `tests/e2e/*.spec.ts` browser suites are omitted from audit output
- property tests are reported as unit tests
- contributors can get a misleading picture of which layers exist and which anti-patterns apply

## Fix

- expand discovery to include the repo's actual test file patterns
- classify layers as `unit`, `property`, `contract`, `integration`, `balance`, and `e2e`
- add integration coverage around discovery and layer mapping
