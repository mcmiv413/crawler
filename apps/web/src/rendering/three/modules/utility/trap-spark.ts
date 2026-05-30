/**
 * Three.js module for `fx.utility.trap-spark`.
 * Visual: yellow spark burst when a trap triggers, with glow and particles.
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

export const trapSpark: ThreeAnimationModule<Instance> = {
  id: animationRefs.utility.trapSpark.id,
  category: animationRefs.utility.trapSpark.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const circleGeo = new THREE.CircleGeometry(tileSize * 0.3, 12);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(circleGeo, meshMaterial);
    mesh.scale.setScalar(0.2);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xffff00, radiusPx: tileSize * 0.5, opacity: 0.55 });
    const burst = createParticleBurst({ count: 18, spreadPx: tileSize * 0.7, startColor: 0xffff88, endColor: 0xffcc00, gravityPx: tileSize * 0.15, sizePx: tileSize * 0.075, seed: 501, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [circleGeo, burst.geometry],
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
    instance.mesh.scale.setScalar(0.2 + progress * 1.3);
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
