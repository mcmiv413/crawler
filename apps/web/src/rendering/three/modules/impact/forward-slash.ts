/**
 * Three.js module for `fx.impact.forward-slash`.
 * Visual: white diagonal slash with glow and particles.
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

export const forwardSlash: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.forwardSlash.id,
  category: animationRefs.impact.forwardSlash.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const slashGeo = new THREE.PlaneGeometry(tileSize, tileSize);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(slashGeo, meshMaterial);
    mesh.rotation.z = Math.PI / 4;
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xffffff, radiusPx: tileSize * 0.65, opacity: 0.35 });
    const burst = createParticleBurst({ count: 10, spreadPx: tileSize * 0.7, startColor: 0xffffff, endColor: 0xffdddd, gravityPx: 0, sizePx: tileSize * 0.075, seed: 205, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [slashGeo, burst.geometry],
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
    instance.meshMaterial.opacity = 1 - progress;
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
