# BUG: brittle numeric `.toBe()` assertions are documented but not merge-blocking

**Status:** Fixed
**Severity:** Medium
**Files:** `eslint.config.mjs`, `scripts/check-audit-guardrails.mjs`, `packages/game-core/src/systems/**/*.test.ts`

## Description

The testing guide prohibits exact assertions on tunable values, but `dungeon/no-numeric-toBe` is currently configured as a warning in game-core system tests. `pnpm validate` therefore permits known brittle numeric assertions to ship without blocking the merge gate.

## Root Cause

The lint rule exists, but the scoped severity is non-blocking and the audit guardrail smoke check does not assert that the rule remains enforced as an error.

## Impact

- tune-sensitive tests can keep hardcoding exact numeric expectations
- CI reports the issue without preventing regressions
- the documented testing rule is weaker in code than it appears in docs

## Fix

- replace current numeric literal `.toBe(...)` offenders with comparative or invariant assertions
- ratchet `dungeon/no-numeric-toBe` to an error for the intended test scope
- extend the audit guardrail check so downgrading the rule is caught early
