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
import type {
  ThreeEffectContext,
  ThreeEffectModule,
  ThreeEffectScreenPosition,
} from '../three-effect-types.js';

interface YourEffectInstance {
  readonly scene: ThreeEffectContext['scene'];
  readonly canvasHeight: number;
  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.CircleGeometry;
  readonly material: THREE.MeshBasicMaterial;
}

export const yourEffect: ThreeEffectModule<YourEffectInstance> = {
  create(context: ThreeEffectContext) {
    // Build the effect in tile-relative units, then scale the group into pixels.
    const group = new THREE.Group();
    const geometry = new THREE.CircleGeometry(0.45, 24);
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.2);
    group.add(mesh);
    group.scale.setScalar(context.tileSize);
    context.scene.add(group);

    return {
      scene: context.scene,
      canvasHeight: context.canvasHeight,
      group,
      mesh,
      geometry,
      material,
    };
  },

  setPosition(effect, position: ThreeEffectScreenPosition): void {
    // Overlay pixels use a top-left origin, but the Three scene uses a flipped Y axis.
    effect.group.position.set(position.x, effect.canvasHeight - position.y, position.z);
  },

  update(effect, progress: number): void {
    // progress: 0.0 (start) to 1.0 (end)
    effect.mesh.scale.setScalar(0.2 + progress * 0.8);
    effect.material.opacity = 1 - progress;
  },

  dispose(effect): void {
    effect.scene.remove(effect.group);
    effect.geometry.dispose();
    effect.material.dispose();
  },
};
```

**Step 3: Register the module and add its handled animation ID metadata**

Edit `apps/web/src/rendering/three/effects/index.ts`:

```typescript
import { register } from '../three-effect-registry.js';
import { animationRefs } from '@dungeon/content';
import { yourEffect } from './your-effect-effect.js';

const YOUR_EFFECT_ID = animationRefs.self.healingPulse.id;

register(YOUR_EFFECT_ID, yourEffect);
```

Then add the ID to `apps/web/src/rendering/three-effect-metadata.ts`:

```typescript
import { animationRefs, type AnimationId } from '@dungeon/content';

const YOUR_EFFECT_ID = animationRefs.self.healingPulse.id;

export const BUILT_IN_THREE_EFFECT_IDS = [
  YOUR_EFFECT_ID,
] as const satisfies readonly AnimationId[];
```

**Step 4: Add contract test coverage** (MANDATORY)

The contract test `apps/web/src/rendering/three/three-effects.contract.test.ts` automatically validates all IDs in `BUILT_IN_THREE_EFFECT_IDS` against live content and guards metadata/registration parity. When you add a new ID, the test will fail until that ref exists in `@dungeon/content` and the built-in Three registrations stay in sync.

If you need custom validation (e.g., checking that an ability actually uses your effect), add it to that contract test file.

### Testing Three.js Effects

**Unit tests:** Use **local fixture IDs**, not live content imports.

Three effect modules receive **pixel-space overlay positions** via `setPosition()`. Use `tileSize` to size meshes, not to place them. The stock healing pulse stores `canvasHeight` on the instance and flips `y` with `canvasHeight - position.y` because overlay pixel coordinates start at the top-left while the Three scene uses the orthographic camera's flipped Y axis.

```typescript
import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { yourEffect } from './your-effect-effect.js';

describe('yourEffect', () => {
  it('creates a mesh on initialization', () => {
    const scene = new THREE.Scene();
    const effect = yourEffect.create({
      renderer: {} as never,
      scene,
      camera: {} as never,
      canvasWidth: 720,
      canvasHeight: 528,
      vpLeft: 0,
      vpTop: 0,
      tileSize: 24,
    });
    expect(effect.group).toBeDefined();
    expect(scene.children).toContain(effect.group);
  });

  it('updates opacity during progress', () => {
    const effect = yourEffect.create({
      renderer: {} as never,
      scene: new THREE.Scene(),
      camera: {} as never,
      canvasWidth: 720,
      canvasHeight: 528,
      vpLeft: 0,
      vpTop: 0,
      tileSize: 24,
    });
    yourEffect.update(effect, 0);
    expect(effect.material.opacity).toBe(1);
    yourEffect.update(effect, 1);
    expect(effect.material.opacity).toBe(0);
  });

  it('positions in overlay pixel space', () => {
    const effect = yourEffect.create({
      renderer: {} as never,
      scene: new THREE.Scene(),
      camera: {} as never,
      canvasWidth: 720,
      canvasHeight: 528,
      vpLeft: 0,
      vpTop: 0,
      tileSize: 24,
    });

    yourEffect.setPosition(effect, { x: 120, y: 168, z: 0 });
    expect(effect.group.position.x).toBe(120);
    expect(effect.group.position.y).toBe(528 - 168);
  });
});
```

**Contract tests:** Validate against live content (this is the one place where importing `@dungeon/content` is correct).

Three effect modules are still just renderer implementations. Content keeps declaring animation refs, presenter emits `animationId`s, and the web layer decides whether canvas or the lazy Three overlay renders a handled ID.

See `apps/web/src/rendering/three/three-effects.contract.test.ts` — it automatically validates all registered IDs and built-in registration parity.

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
