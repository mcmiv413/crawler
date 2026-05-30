/**
 * Three.js module for `fx.aoe.shatter-burst`.
 * Visual: icy shockwave ring with glow and ice particle burst.
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

export const shatterBurst: ThreeAnimationModule<Instance> = {
  id: animationRefs.aoe.shatterBurst.id,
  category: animationRefs.aoe.shatterBurst.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ring = createShockwaveRing({ innerRadiusPx: tileSize * 0.25, outerRadiusPx: tileSize * 0.5, color: 0xaaddff, startScale: 0.3, endScale: 2.3, opacity: 0.85, fadeStart: 0 });
    const glow = createSoftGlow({ color: 0x99eeff, radiusPx: tileSize * 0.95, opacity: 0.45 });
    const burst = createParticleBurst({ count: 32, spreadPx: tileSize * 1.5, startColor: 0xddeeff, endColor: 0x66bbff, gravityPx: tileSize * 0.15, sizePx: tileSize * 0.1, seed: 104, tileSize });

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
