/**
 * Three.js module for `fx.self.second-wind-buff`.
 * Visual: cyan glow plane that pulses in and out, with glow and rising motes.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createSoftGlow, type SoftGlow } from '../../lib/soft-glow.js';
import { createParticleBurst, type ParticleBurst } from '../../lib/particle-burst.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly mesh: THREE.Mesh;
  readonly meshMaterial: THREE.MeshBasicMaterial;
  readonly glow: SoftGlow;
  readonly burst: ParticleBurst;
}

export const secondWindBuff: ThreeAnimationModule<Instance> = {
  id: animationRefs.self.secondWindBuff.id,
  category: animationRefs.self.secondWindBuff.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const planeGeo = new THREE.PlaneGeometry(tileSize, tileSize);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(planeGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0x00ffcc, radiusPx: tileSize * 0.75, opacity: 0.55 });
    const burst = createParticleBurst({ count: 14, spreadPx: tileSize * 0.7, startColor: 0x99ffee, endColor: 0x00ffcc, gravityPx: -tileSize * 0.3, sizePx: tileSize * 0.075, seed: 404, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [planeGeo, burst.geometry],
      materials: [meshMaterial, glow.material, burst.material],
      mesh,
      meshMaterial,
      glow,
      burst,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    const opacity = progress < 0.5
      ? progress * 2 * 0.8
      : Math.max(0, 0.8 - (progress - 0.5) * 2 * 0.8);
    instance.meshMaterial.opacity = opacity;
    instance.glow.setOpacity(opacity);
    instance.burst.update(progress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.glow.dispose();
    instance.burst.dispose();
  },
};
