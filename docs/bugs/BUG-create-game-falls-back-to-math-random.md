# BUG: createNewGame falls back to `Math.random()` when no seed is supplied

**Status:** Fixed
**Severity:** High
**Files:** `packages/game-core/src/engine/game-engine.ts`, `apps/server/src/app.ts`, `scripts/check-audit-guardrails.mjs`

## Description

`GameEngine.createNewGame(seed?: number)` generated the game seed with `Math.random()` when the caller did not pass one.

This leaves the core creation path nondeterministic even though saved-state reproducibility and seeded replay are treated as important guardrails elsewhere in the repo.

## Root Cause

- core owns default seed generation instead of requiring an explicit seed source
- the audit guardrail script only checks for `Date.now()` in game-core persisted gameplay code
- determinism tests focus on seeded runs and do not block the unseeded creation path

## Impact

- two nominally identical "new game" requests can produce different persisted seeds with no explicit boundary owning that choice
- deterministic debugging and replay workflows are weaker than they appear
- nondeterministic core behavior is not merge-blocked by the current guardrail script

## Fix

- move default seed generation to an explicit app boundary or require the caller to provide one
- remove `Math.random()` from the core creation path
- extend guardrails and tests so unseeded randomness in persisted gameplay code is caught automatically

## Resolution

- `apps/server/src/app.ts` now owns the default seed with `node:crypto` entropy before calling the engine
- `packages/game-core/src/engine/game-engine.ts` requires an explicit seed and no longer falls back to `Math.random()`
- `scripts/check-audit-guardrails.mjs` now blocks both `Date.now()` and `Math.random()` in persisted gameplay code
