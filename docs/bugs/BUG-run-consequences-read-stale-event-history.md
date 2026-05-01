# BUG: run consequences read stale event history

**Status:** Resolved
**Severity:** High
**Files:** `apps/server/src/game-command/process-command.ts`, `packages/game-core/src/engine/game-engine.ts`, `packages/game-core/src/systems/world-consequences.ts`

## Description

Run-ending consequence logic evaluates `state.world.eventHistory` before the just-emitted command events are appended to that history. `GameEngine.submitCommand()` calls `applyRunConsequences()` during the command pipeline, but `processGameCommand()` does not append `result.events` into `state.world.eventHistory` until after the engine work is already finished.

As a result, threshold-based consequence logic such as `evaluateEventChains()` runs against stale history. A run that should satisfy a history threshold with its own events only becomes visible to the consequence system on a later command or later run end.

## Root Cause

Event-history ownership is split across layers:

- the engine reads `state.world.eventHistory` for consequence decisions
- the server appends the authoritative event list afterward

That ordering makes engine behavior depend on persistence-layer mutation that has not happened yet.

## Impact

- Event-chain thresholds can fire one run late instead of immediately
- Run summaries and town consequence deltas can miss same-run triggers
- Presenter surfaces that summarize town changes from recent event history only become accurate after a later persistence cycle

## Resolution

- event history is now appended in the engine-owned command result before restore/presenter consumers rely on it
- run consequences evaluate against current-command events, not stale persisted history
- regression coverage was added for same-run fear escalation through the real command path
