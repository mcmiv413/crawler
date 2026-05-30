/**
 * Three.js module for `fx.impact.cleave-arc`.
 * Visual: pale-blue sweep with glow and particles.
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

export const cleaveArc: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.cleaveArc.id,
  category: animationRefs.impact.cleaveArc.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const sweepGeo = new THREE.PlaneGeometry(tileSize * 1.5, tileSize);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(sweepGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0x88ccff, radiusPx: tileSize * 0.9, opacity: 0.3 });
    const burst = createParticleBurst({ count: 10, spreadPx: tileSize * 0.9, startColor: 0xccf2ff, endColor: 0x4488cc, gravityPx: 0, sizePx: tileSize * 0.08, seed: 202, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [sweepGeo, burst.geometry],
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
    instance.meshMaterial.opacity = Math.max(0, 1 - progress * 1.2);
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
