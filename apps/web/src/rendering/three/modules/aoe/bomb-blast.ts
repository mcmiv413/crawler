/**
 * Three.js module for `fx.aoe.bomb-blast`.
 * Visual: expanding shockwave with glow and particle burst.
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
  readonly tileSize: number;
}

export const bombBlast: ThreeAnimationModule<Instance> = {
  id: animationRefs.aoe.bombBlast.id,
  category: animationRefs.aoe.bombBlast.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ring = createShockwaveRing({ innerRadiusPx: tileSize * 0.35, outerRadiusPx: tileSize * 0.55, color: 0xff4400, startScale: 0.2, endScale: 2.6, opacity: 0.95, fadeStart: 0.3 });
    const glow = createSoftGlow({ color: 0xff6622, radiusPx: tileSize * 0.9, opacity: 0.65 });
    const burst = createParticleBurst({ count: 28, spreadPx: tileSize * 1.8, startColor: 0xffaa33, endColor: 0xff2200, gravityPx: tileSize * 0.35, sizePx: tileSize * 0.13, seed: 101, tileSize });

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
      tileSize,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    instance.ring.update(progress);
    instance.burst.update(progress);
    const { tileSize, glow } = instance;
    glow.setScale(tileSize * (0.6 + progress * 1.2));
    glow.setOpacity(progress < 0.3 ? 0.65 : 0.65 * (1 - (progress - 0.3) / 0.7));
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.ring.dispose();
    instance.glow.dispose();
    instance.burst.dispose();
  },
};
