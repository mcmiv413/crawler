/**
 * Three.js module for `fx.impact.shatter-burst`.
 * Visual: icy burst scaling up with glow and ice particles.
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

export const shatterBurst: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.shatterBurst.id,
  category: animationRefs.impact.shatterBurst.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const icyGeo = new THREE.PlaneGeometry(tileSize, tileSize);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x99eeff, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(icyGeo, meshMaterial);
    mesh.scale.setScalar(0.5);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0x99eeff, radiusPx: tileSize * 0.75, opacity: 0.4 });
    const burst = createParticleBurst({ count: 20, spreadPx: tileSize * 0.95, startColor: 0xddf8ff, endColor: 0x66ccff, gravityPx: tileSize * 0.1, sizePx: tileSize * 0.08, seed: 208, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [icyGeo, burst.geometry],
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
    instance.mesh.scale.setScalar(0.5 + progress * 1.5);
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
