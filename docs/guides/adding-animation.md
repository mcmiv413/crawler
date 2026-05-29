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

---

## Three.js Rendering Layer (Optional WebGL Effects)

Animation IDs power two independent rendering backends in the web client: **Canvas** (always available) and **Three.js** (optional WebGL overlay).

### Architecture Overview

```
Animation Ref (Content)
    ↓
    ├─ Canvas Animation Module (apps/web/src/animations/modules/*)
    │  └─ Draws on 2D canvas context
    │
└─ Three.js Effect Module (apps/web/src/rendering/three/effects/*)
   └─ Transparent WebGL overlay above canvas
```

**Key principle:** The same `AnimationId` can have implementations in both renderers. The **presenter** emits `animationId` strings via `ConsumableAnimationEntry` and `FxAnimationEntry` in the game view. Each renderer implementation decides whether to process that ID.

### The Rendering Boundary

- **Canvas is mandatory** — `DungeonCanvas` is the primary map renderer and uses `animationId` to look up frame data or trigger 2D animations.
- **Three.js is optional** — WebGL overlays are presentation-only, keyed by the same `AnimationId` values.
- **Graceful degradation** — If Three.js setup fails or the feature flag is disabled, the game remains fully playable with canvas-only rendering.

### When to Add a Canvas Animation Module

Add a canvas animation module (`apps/web/src/animations/modules/`) when:
- The effect is **visual and foundational** to gameplay (hit effects, movement trails, status indicators)
- You need **performance at scale** (many simultaneous animations)
- The effect works in **web-native 2D canvas** (sprite frames, geometric shapes, text overlays)

Example: a simple red flash on hit impact, a melee slash effect, floating damage numbers.

### When to Add a Three.js Effect Module

Add a Three.js effect module (`apps/web/src/rendering/three/effects/`) when:
- The effect is **primarily visual enhancement** — it's nice to have, not required
- You need **advanced rendering** (particle systems, 3D geometry, complex shaders, lighting effects)
- The effect is **GPU-accelerated** (better performance than 2D for complex visuals)
- You want to **preserve canvas performance** (offload heavy graphics to WebGL)

Example: animated 3D particles for a spell, a glowing aura with shader effects, a lens flare overlay.

### How to Add a Three.js Effect Module

**Step 1: Define the animation ref** in `packages/content/src/animation-refs/`

```typescript
// packages/content/src/animation-refs/self.ts
export const healingPulseRef = {
  id: 'fx.self.healing-pulse' as const,
  category: 'self',
  durationMs: 600,
  impactFrameMs: 300,
  recoveryMs: 200,
} satisfies AnimationRef;
```

Then regenerate indexes:
```bash
pnpm generate:indexes
```

**Step 2: Implement the Three.js effect module**

Create a file at `apps/web/src/rendering/three/effects/{effect-name}-effect.ts`:

```typescript
import * as THREE from 'three';
import type { ThreeEffectModule, ThreeEffectContext } from '../three-effect-types.js';

export const yourEffect: ThreeEffectModule = {
  create(context: ThreeEffectContext) {
    // Set up Three.js objects (geometry, material, mesh, group)
    const group = new THREE.Group();
    // ... add meshes, initialize state ...
    context.scene.add(group);
    return { group, /* other state */ };
  },

  update(effect: unknown, progress: number): void {
    // progress: 0.0 (start) to 1.0 (end)
    // Update position, scale, opacity, rotation, etc.
    const inst = effect as any; // Cast to your instance type
    inst.material.opacity = 1 - progress; // Example: fade out
  },

  dispose(effect: unknown): void {
    // Clean up: remove from scene, dispose geometries and materials
    const inst = effect as any;
    context.scene.remove(inst.group);
    inst.geometry.dispose();
    inst.material.dispose();
  },
};
```

**Step 3: Register the module in the effect index**

Edit `apps/web/src/rendering/three/effects/index.ts`:

```typescript
import { register } from '../three-effect-registry.js';
import { animationRefs } from '@dungeon/content';
import { yourEffect } from './your-effect-effect.js';

const YOUR_EFFECT_ID = animationRefs.self.healingPulse.id;

register(YOUR_EFFECT_ID, yourEffect);

export const BUILT_IN_THREE_EFFECT_IDS: readonly string[] = [
  YOUR_EFFECT_ID,
];
```

**Step 4: Add contract test coverage** (MANDATORY)

The contract test `tests/contracts/three-effects-animation-refs.contract.test.ts` automatically validates all IDs in `BUILT_IN_THREE_EFFECT_IDS` against live content. When you add a new ID, the test will fail until that ref exists in `@dungeon/content`.

If you need custom validation (e.g., checking that an ability actually uses your effect), add it to the contract test file.

### Testing Three.js Effects

**Unit tests:** Use **local fixture IDs**, not live content imports.

```typescript
import { describe, it, expect } from 'vitest';
import { yourEffect } from './your-effect-effect.js';

// Use a fixture ID, not a real animation ID from @dungeon/content
const FIXTURE_ID = 'fx.test.my-effect-test';

describe('yourEffect', () => {
  it('creates a mesh on initialization', () => {
    const context = { scene: new THREE.Scene() };
    const effect = yourEffect.create(context);
    expect(effect.group).toBeDefined();
    expect(context.scene.children).toContain(effect.group);
  });

  it('updates opacity during progress', () => {
    const context = { scene: new THREE.Scene() };
    const effect = yourEffect.create(context);
    yourEffect.update(effect, 0);
    expect(effect.material.opacity).toBe(1);
    yourEffect.update(effect, 1);
    expect(effect.material.opacity).toBe(0);
  });
});
```

**Contract tests:** Validate against live content (this is the one place where importing `@dungeon/content` is correct).

See `tests/contracts/three-effects-animation-refs.contract.test.ts` — it automatically validates all registered IDs.

### Feature Flag: VITE_THREE_EFFECTS

The Three.js overlay is controlled by the `VITE_THREE_EFFECTS` environment variable:

```bash
# Enable Three.js effects
VITE_THREE_EFFECTS=true pnpm dev:web

# Disable Three.js effects (canvas only)
VITE_THREE_EFFECTS=false pnpm dev:web
```

**Why this matters:**
- In CI/test environments, Three.js may not initialize (headless, no WebGL context).
- Contributors on low-end machines can disable it for better performance.
- The game is **always fully playable** — Three.js is a visual enhancement, not a requirement.

If WebGL setup fails at runtime, the app gracefully skips effect registration and continues with canvas-only rendering.

### Why Separate Animations and Renderers?

This separation achieves three goals:

1. **Presenter ignorance** — The game engine and presenter never know about Three.js. They only emit `animationId` strings.
2. **Rendering flexibility** — Canvas animation modules can be lightweight sprites; Three.js modules can be heavy 3D effects. Each renderer picks what it can handle.
3. **Progressive enhancement** — Add Three.js effects without breaking canvas-only setups or affecting game logic.
