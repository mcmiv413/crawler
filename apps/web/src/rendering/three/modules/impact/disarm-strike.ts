/**
 * Three.js module for `fx.impact.disarm-strike`.
 * Visual: spinning gold plane with glow and particles.
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

export const disarmStrike: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.disarmStrike.id,
  category: animationRefs.impact.disarmStrike.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const spinGeo = new THREE.PlaneGeometry(tileSize, tileSize);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(spinGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xffcc44, radiusPx: tileSize * 0.7, opacity: 0.45 });
    const burst = createParticleBurst({ count: 14, spreadPx: tileSize * 0.75, startColor: 0xffffaa, endColor: 0xffaa22, gravityPx: tileSize * 0.1, sizePx: tileSize * 0.08, seed: 203, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [spinGeo, burst.geometry],
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
    instance.mesh.rotation.z = progress * Math.PI * 2;
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
