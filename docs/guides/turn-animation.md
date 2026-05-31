# Turn Animation Beat Model

## Overview

Turn animation sequencing is presenter-owned. `buildAnimationSequence()` emits only the beats that remain visible in the current dungeon view, and the web scheduler drains those visible beats in order.

## Beat Rules

- one beat per acting entity
- player beat comes first when the player produced animation events
- enemy beats follow in descending speed order
- wait turns do not reserve an empty player beat
- events inside one beat share the same `beatId`
- beats that are completely outside the current field of view collapse before they reach the web queue
- visible-entering and visible-leaving movement beats stay in order instead of being dropped

## Timing

Each event keeps:

- `beatIndex`
- `beatId`
- `beatRelativeDelayMs`
- legacy `delayMs` for backward compatibility

Beat settle time is based on animation timing metadata:

```text
max(durationMs, impactFrameMs + recoveryMs) + hitStopMs
```

The presenter exports `getBeatSettleMs()` and `getAnimatedEventBatchSettleMs()` so the web store and scheduler use the same settle math for the visible batch that the player actually sees.

## Queue Drain Gating

When a dungeon command returns visible animated beats, the store stages the resolved `GameView` immediately so sprite rendering and animation payloads stay aligned. The beat scheduler still owns when the staged combat log and view commit as the settled state.

Walking continuation no longer waits for the full visible queue to drain. The web walk controller watches the active player move beat, schedules the next confirmed `MOVE` at the shared step boundary, and only dispatches once the current command has finished loading. Hidden beats still never enter the queue, so off-FOV enemy turns do not extend visible settle time or stall click-to-move continuation.

## Walking Continuity

Movement style selection is still presenter-owned, but the default baseline is now shared:

- player and enemy move beats both default to the `step` timing profile
- enemy archetype overrides remain available behind an explicit dormant presenter seam

The web runtime layers continuity on top of that shared baseline:

- `useMoveAnimationState()` carries only travel offset between same-entity steps
- step secondary motion is a subtle stride bob/squash, computed per frame and never accumulated into takeover state
- step easing uses web-only walk phases so the first confirmed step eases in, interior steps stay linear, and the last confirmed step eases out
- `useWalkController()` paces held-key walking and auto-walk from the same boundary-cross signal instead of raw key repeat or full-queue waits

## Where to Tune Motion

- beat decomposition and settle semantics: `packages/presenter/src/animation-sequence.ts`
- animation timing metadata: `packages/presenter/src/animation-metadata.ts`
- move rendering profiles: `apps/web/src/animations/move-style-profiles.ts`
- walk continuity controller: `apps/web/src/hooks/useWalkController.ts`
- beat scheduler + queue bus: `apps/web/src/animation-runtime/useAnimationOrchestrator.beat.ts`
- staged command-result commits: `apps/web/src/store/game-store.ts`
