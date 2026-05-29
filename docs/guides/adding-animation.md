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

1. Add or update a ref in `packages/content/src/animation-refs/{impact,projectile,self,aoe,status,utility}.ts`.
2. Fill in `durationMs`, `impactFrameMs`, and `recoveryMs`.
3. Run:

```bash
pnpm generate:indexes
```

This regenerates both `packages/content/src/animation-refs/index.ts` and `apps/web/src/rendering/three/generated/index.ts`. Do not hand-edit either generated file.

## Beat Timing

The presenter beat model uses `impactFrameMs` to place damage numbers, hit-stop, and defender-hit flashes inside a beat. `recoveryMs` contributes to beat settle time so the next actor does not overlap the current animation.

## Validation

- `packages/content/src/animation-refs/index.test.ts` checks timing fields and `suppressActorBump`
- `tests/integration/animation-refs-generator.integration.test.ts` guards generator enforcement
- `pnpm run check:three-animations` guards Three registry coverage against live content refs
- Finish with `pnpm validate`

---

## Three Renderer Workflow

Animation IDs feed two renderers in the web client:

1. **DungeonCanvas** - complete canvas fallback and baseline presentation
2. **ThreeAnimationOverlay** - WebGL backend for handled animation modules, moving/bumping entity takeover, status pulses, combat labels, and defender-hit flashes

`apps/web/src/components/ThreeAnimationOverlay.tsx` is the production lazy wrapper. `apps/web/src/components/ThreeEffectsOverlay.tsx` and `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx` are compatibility aliases only; do not add new behavior there.

### One-owner rule

- Canvas stays complete enough to render the feature when the renderer mode is `canvas` or WebGL creation fails.
- Three only suppresses canvas output after the overlay reports ownership for that specific surface.
- Status ring pulses and status scale, move/bump entity takeover, and combat labels follow the same rule: no dual rendering, no partial ownership.

### Where Three modules live

Three modules live under:

```text
apps/web/src/rendering/three/modules/<category>/<name>.ts
```

Supported categories mirror the content refs:

- `impact`
- `projectile`
- `self`
- `aoe`
- `status`
- `utility`

The generated registry is sourced from `scripts/generators/three-animation-modules.ts`. Export a module constant typed as `ThreeAnimationModule`, then rerun `pnpm generate:indexes`. Do **not** hand-maintain legacy manual registry lists or manual metadata arrays.

### When to add a Three module

Add a Three module when the feature needs one of these:

- persistent WebGL-owned presentation instead of canvas fallback-only rendering
- source-to-target projectile travel or richer impact/aoe treatment
- entity takeover during move/bump/status ownership
- combat text or flash visuals that belong on the overlay layer

If the player-visible behavior must survive renderer fallback, keep the canvas path correct too.

### Module authoring contract

Use `ThreeAnimationModule` from `apps/web/src/rendering/three/three-animation-types.ts`.

```typescript
import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type {
  ThreeAnimationContext,
  ThreeAnimationModule,
  ThreeAnimationPosition,
} from '../three-animation-types.js';

interface ExampleInstance {
  readonly scene: ThreeAnimationContext['scene'];
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.RingGeometry;
  readonly material: THREE.MeshBasicMaterial;
}

export const exampleHealingPulse: ThreeAnimationModule<ExampleInstance> = {
  id: animationRefs.self.healingPulse.id,
  category: animationRefs.self.healingPulse.category,

  create(context: ThreeAnimationContext): ExampleInstance {
    const geometry = new THREE.RingGeometry(
      context.tileSize * 0.25,
      context.tileSize * 0.45,
      24,
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    context.scene.add(mesh);
    return { scene: context.scene, mesh, geometry, material };
  },

  setPosition(instance: ExampleInstance, position: ThreeAnimationPosition): void {
    instance.mesh.position.set(position.x, position.y, position.z);
  },

  update(instance: ExampleInstance, progress: number): void {
    instance.mesh.scale.setScalar(0.6 + progress * 0.6);
    instance.material.opacity = 1 - progress * 0.85;
  },

  dispose(instance: ExampleInstance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
```

### Position contract

- `setPosition()` receives overlay pixel coordinates that are already transformed by `ThreeAnimationOverlay`.
- **Do not flip Y inside the module.** The overlay owns the single Y-axis conversion point.
- Projectile-capable modules can read `position.source` and `position.target` to interpolate travel from actor to defender.
- Size geometry with `context.tileSize`; do not hardcode pixel literals in modules.

### Registry and metadata

After you add a module:

1. rerun `pnpm generate:indexes`
2. confirm `apps/web/src/rendering/three/generated/index.ts` registers the module
3. do **not** edit `apps/web/src/rendering/three-effect-metadata.ts` by hand - built-in handled IDs are derived from the generated registry

### Required proofs

1. **Unit/module contract** - call `runThreeAnimationContract()` from `apps/web/src/rendering/three/testing/run-three-animation-contract.ts`
2. **Registry parity** - keep `apps/web/src/rendering/three/three-effects.contract.test.ts` green
3. **Coverage guardrail** - keep `pnpm run check:three-animations` green so every content `AnimationId` has a matching Three module
4. **Component ownership** - add or update `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx` or `apps/web/src/components/DungeonPhase.test.tsx`
5. **Browser proof** - extend `tests/e2e/three-animation-backend.spec.ts` so Playwright samples `data-testid="three-animation-overlay"` with `gl.readPixels()`

The browser proof is where we verify category ownership end to end: movement, bump/attack, projectile, impact, aoe, self/consumable, status pulse, combat label, defender-hit flash, pointer safety, forced WebGL failure fallback, and the negative proof that the 2D dungeon canvas cannot satisfy the WebGL assertion.

### Docs example compile fixture

`apps/web/src/rendering/three/testing/three-animation-docs.fixture.ts` mirrors the public module example in this guide. Keep it type-correct when updating the docs so `pnpm run check:fast` catches drift.

### Renderer mode

The source of truth is `getAnimationRendererMode()` in `apps/web/src/config/feature-flags.ts`:

```bash
VITE_ANIMATION_RENDERER_MODE=three pnpm dev:web
VITE_ANIMATION_RENDERER_MODE=canvas pnpm dev:web
```

- `canvas` is the default until the WebGL backend is explicitly enabled
- `isThreeEffectsEnabledFlag()` is only a compatibility alias over renderer mode
- if WebGL renderer creation fails at runtime, the overlay reports no ownership and canvas fallback stays active

### Why the split exists

This separation keeps responsibilities clean:

1. **Content** declares IDs and timing
2. **Presenter** emits display-ready animation entries
3. **Web canvas** remains the safe fallback path
4. **WebGL overlay** adds richer visuals without changing game logic
