/**
 * Three.js module for `fx.impact.radial-impact-burst`.
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

export const radialImpactBurst: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.radialImpactBurst.id,
  category: animationRefs.impact.radialImpactBurst.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ring = createShockwaveRing({ innerRadiusPx: tileSize * 0.2, outerRadiusPx: tileSize * 0.5, color: 0xff8800, startScale: 0.5, endScale: 1, opacity: 1, fadeStart: 0 });
    const glow = createSoftGlow({ color: 0xff8800, radiusPx: tileSize * 0.75, opacity: 0.35 });
    const burst = createParticleBurst({ count: 16, spreadPx: tileSize * 0.9, startColor: 0xffbb55, endColor: 0xff5500, gravityPx: tileSize * 0.2, sizePx: tileSize * 0.08, seed: 206, tileSize });

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
