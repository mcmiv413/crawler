# BUG: fast enemies lose extra actions after moving

**Status:** Fixed
**Severity:** High
**Files:** `packages/game-core/src/engine/turn-scheduler.ts`, `packages/game-core/src/engine/turn-scheduler.test.ts`

## Description

`processEnemyTurns()` supports multi-action enemies through `speedAccumulators`, but the inner loop reacquires each enemy from the original position snapshot taken by the outer loop. When a fast enemy spends its first action on movement, the second lookup still checks the stale position key and stops the loop even if the accumulator still permits another action.

## Root Cause

The scheduler tracks extra actions by stable `enemy.id`, but the fresh enemy lookup uses `posKey(enemy.position)` from the pre-move snapshot instead of reacquiring by stable id after state changes.

## Impact

- fast movers can lose same-turn follow-up actions
- movement-heavy archetypes underperform their configured speed
- the current scheduler tests verify aggregate action frequency but not move-then-follow-up behavior in a single scheduler call

## Fix

- reacquire enemies by stable id inside the scheduler loop
- add a focused regression that proves a fast enemy can move and then immediately spend its remaining action
