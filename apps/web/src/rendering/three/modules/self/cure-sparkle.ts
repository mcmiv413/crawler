/**
 * Three.js module for `fx.self.cure-sparkle`.
 * Visual: white sparkle ring with glow and rising motes.
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

export const cureSparkle: ThreeAnimationModule<Instance> = {
  id: animationRefs.self.cureSparkle.id,
  category: animationRefs.self.cureSparkle.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(tileSize * 0.15, tileSize * 0.4, 20);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ringGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xffffff, radiusPx: tileSize * 0.6, opacity: 0.45 });
    const burst = createParticleBurst({ count: 16, spreadPx: tileSize * 0.7, startColor: 0xffffff, endColor: 0xaaffff, gravityPx: -tileSize * 0.35, sizePx: tileSize * 0.07, seed: 402, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [ringGeo, burst.geometry],
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
    instance.mesh.rotation.z = progress * Math.PI;
    instance.meshMaterial.opacity = Math.max(0, 1 - progress);
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
