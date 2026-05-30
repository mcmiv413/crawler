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

When a dungeon command returns visible animated beats, the store stages the resolved `GameView` immediately so sprite rendering and animation payloads stay aligned. The beat scheduler marks the queue as draining, and auto-walk waits on that visible queue before sending the next step.

When the queue drains, the staged combat log and view are committed as the settled state. Hidden beats never enter the queue, so off-FOV enemy turns do not extend visible settle time or stall click-to-move continuation.

## Where to Tune Motion

- beat decomposition and settle semantics: `packages/presenter/src/animation-sequence.ts`
- animation timing metadata: `packages/presenter/src/animation-metadata.ts`
- move rendering profiles: `apps/web/src/animations/move-style-profiles.ts`
- beat scheduler + queue bus: `apps/web/src/animation-runtime/useAnimationOrchestrator.beat.ts`
- staged command-result commits: `apps/web/src/store/game-store.ts`
