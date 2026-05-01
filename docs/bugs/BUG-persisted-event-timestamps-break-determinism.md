# BUG: persisted event timestamps break seeded determinism

**Status:** Resolved
**Severity:** High
**Files:** `packages/game-core/src/engine/turn-scheduler.ts`, `packages/game-core/src/systems/death.ts`, `packages/game-core/src/systems/world-consequences.ts`, `apps/server/src/game-command/process-command.ts`, `packages/game-core/src/state/serialization.ts`, `scripts/check-audit-guardrails.mjs`

## Description

Core domain events are stamped with `Date.now()`, then persisted into `state.world.eventHistory`, and finally serialized as part of the authoritative `GameState`. Two identical command sequences on the same seed can therefore produce different saved state solely because wall-clock time changed.

This is not limited to debug metadata. The timestamped events are kept in the persistent state surface that restore flow, presenter summaries, and history-driven systems consume.

## Root Cause

- gameplay code emits persisted domain events with real wall-clock timestamps
- server persistence appends those events into `world.eventHistory`
- `serializeState()` writes the full state, including that event history
- the audit guardrail explicitly permits `timestamp: Date.now()` uses, so the nondeterminism is currently institutionalized

## Impact

- Seeded runs are not reproducible at the serialized-state level
- Save/restore output changes across identical command streams
- Debugging, replay validation, and state-signature style checks become noisier than they should be

## Resolution

- persisted gameplay events now use deterministic turn-based timestamps instead of wall-clock values
- replay/property coverage now asserts identical serialized output for identical restored starting states and command streams
- the audit guardrail now rejects `Date.now()` in persisted gameplay code
