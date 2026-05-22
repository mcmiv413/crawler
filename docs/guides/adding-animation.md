# Adding an Animation

## Overview

Animation refs are **content declarations** in `packages/content/src/animation-refs/`. Runtime sequencing stays in the presenter and rendering stays in `apps/web`.

## Required Fields

Every `AnimationRef` must declare:

```typescript
export interface AnimationRef {
  readonly id: AnimationId;
  readonly category: AnimationCategory;
  readonly durationMs: number;
  readonly impactFrameMs: number;
  readonly recoveryMs: number;
  readonly suppressActorBump?: boolean;
  readonly hitStopMs?: number;
  readonly impactFlash?: boolean;
}
```

- `id` uses the `fx.<category>.<name>` shape
- `impactFrameMs` is the moment the effect lands
- `recoveryMs` is the post-impact settle window
- projectile and aoe refs must explicitly set `suppressActorBump`

## Workflow

1. Add or update a ref in `packages/content/src/animation-refs/{impact,projectile,self,aoe,status,utility}.ts`
2. Fill in `durationMs`, `impactFrameMs`, and `recoveryMs`
3. Run:

```bash
pnpm generate:indexes
```

This regenerates `packages/content/src/animation-refs/index.ts`. Do not hand-edit the generated file.

## Beat Timing

The presenter beat model uses `impactFrameMs` to place damage numbers, hit-stop, and defender-hit flashes inside a beat. `recoveryMs` contributes to beat settle time so the next actor does not overlap the current animation.

## Validation

- `packages/content/src/animation-refs/index.test.ts` checks timing fields and `suppressActorBump`
- `tests/integration/animation-refs-generator.integration.test.ts` guards generator enforcement
- Finish with `pnpm validate`
