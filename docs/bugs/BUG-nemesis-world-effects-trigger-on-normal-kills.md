# BUG: nemesis world effects can trigger on normal kills

**Status:** Fixed
**Severity:** High
**Files:** `packages/game-core/src/systems/world-consequences.ts`, `packages/game-core/src/state/world-state.ts`, `packages/game-core/src/engine/handlers/combat.ts`, `packages/game-core/src/engine/game-engine.ts`

## Description

The run-end world-consequences chain treats any recent `ENTITY_DIED` event as a nemesis kill when there are no active nemeses. New games start with an empty `world.nemeses` array, so a normal enemy death followed by run end can satisfy the current predicate and incorrectly award the prosperity/corruption bonus intended for clearing all nemeses.

## Root Cause

`evaluateEventChains()` counts generic `ENTITY_DIED` events instead of a nemesis-specific signal such as `NEMESIS_SLAIN` or explicit slain-nemesis state. The TODO in that function already acknowledges the mismatch, but the reward path remains live.

## Impact

- Ordinary enemy kills can distort town prosperity and corruption at run end
- Nemesis-specific progression is no longer trustworthy as a world-state signal
- Balance tuning and downstream world-state reasoning are skewed by false positives
