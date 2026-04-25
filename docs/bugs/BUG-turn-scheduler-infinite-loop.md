# BUG: turn-scheduler infinite loop when playerSpeed is undefined

**Status:** Fixed
**Severity:** Critical (blocked entire test suite and `pnpm validate`)
**File:** `packages/game-core/src/engine/turn-scheduler.ts`

## Description

`processEnemyTurns()` contains a `while(true)` inner loop designed for enemies to act multiple times per turn based on speed accumulators. When `playerSpeed` is undefined (the common case for non-MOVE commands), the accumulator check and decrement were both skipped, leaving no exit condition for enemies that "wait" (ambient non-alerted behavior). This caused an infinite loop.

## Root Cause

The speed accumulator `break` condition was gated behind `if (playerSpeed !== undefined)`, but there was no fallback for the undefined case. A waiting enemy doesn't move or die, so the only remaining break conditions (player dead, run null, enemy missing) never triggered.

## Fix

Added `actionsThisTurn` counter. When `playerSpeed` is undefined, each enemy acts exactly once (breaks after first action).

## Impact

- Full test suite (`pnpm test`) hung indefinitely
- `pnpm validate` could never complete
- Any game scenario where an enemy was non-alerted and had no ambient profile would hang
