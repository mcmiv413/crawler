/**
 * Three.js module for `fx.impact.stagger-shockwave`.
 * Visual: expanding shockwave ring with glow and particles.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createShockwaveRing, type ShockwaveRing } from '../../lib/shockwave-ring.js';
import { createSoftGlow, type SoftGlow } from '../../lib/soft-glow.js';
import { createParticleBurst, type ParticleBurst } from '../../lib/particle-burst.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly ring: ShockwaveRing;
  readonly glow: SoftGlow;
  readonly burst: ParticleBurst;
}

export const staggerShockwave: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.staggerShockwave.id,
  category: animationRefs.impact.staggerShockwave.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ring = createShockwaveRing({ innerRadiusPx: tileSize * 0.1, outerRadiusPx: tileSize * 0.4, color: 0xaaaaff, startScale: 1, endScale: 3, opacity: 1, fadeStart: 0 });
    const glow = createSoftGlow({ color: 0xaaaaff, radiusPx: tileSize * 0.8, opacity: 0.3 });
    const burst = createParticleBurst({ count: 14, spreadPx: tileSize * 0.8, startColor: 0xddddff, endColor: 0x7777ff, gravityPx: 0, sizePx: tileSize * 0.075, seed: 209, tileSize });

    group.add(ring.object);
    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [ring.geometry, burst.geometry],
      materials: [ring.material, glow.material, burst.material],
      ring,
      glow,
      burst,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    instance.ring.update(progress);
    instance.burst.update(progress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.ring.dispose();
    instance.glow.dispose();
    instance.burst.dispose();
  },
};
