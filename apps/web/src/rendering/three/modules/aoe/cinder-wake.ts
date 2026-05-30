/**
 * Three.js module for `fx.aoe.cinder-wake`.
 * Visual: trailing cinder ring with glow and particle burst.
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

export const cinderWake: ThreeAnimationModule<Instance> = {
  id: animationRefs.aoe.cinderWake.id,
  category: animationRefs.aoe.cinderWake.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ring = createShockwaveRing({ innerRadiusPx: tileSize * 0.25, outerRadiusPx: tileSize * 0.45, color: 0xff6600, startScale: 0.4, endScale: 1.7, opacity: 0.55, fadeStart: 0.1 });
    const glow = createSoftGlow({ color: 0xff7733, radiusPx: tileSize * 1.1, opacity: 0.35 });
    const burst = createParticleBurst({ count: 22, spreadPx: tileSize * 1.4, startColor: 0xff8844, endColor: 0x552200, gravityPx: tileSize * 0.55, sizePx: tileSize * 0.11, lifetimeJitter: 0.35, seed: 102, tileSize });

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
