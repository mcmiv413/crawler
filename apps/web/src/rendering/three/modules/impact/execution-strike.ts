/**
 * Three.js module for `fx.impact.execution-strike`.
 * Visual: bright flash pulse with glow and particles.
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

export const executionStrike: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.executionStrike.id,
  category: animationRefs.impact.executionStrike.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const flashGeo = new THREE.PlaneGeometry(tileSize * 1.2, tileSize * 1.2);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(flashGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xff2200, radiusPx: tileSize * 0.95, opacity: 0.65 });
    const burst = createParticleBurst({ count: 24, spreadPx: tileSize * 1.05, startColor: 0xffffff, endColor: 0xff2200, gravityPx: tileSize * 0.2, sizePx: tileSize * 0.11, seed: 204, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [flashGeo, burst.geometry],
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
    if (progress < 0.4) {
      instance.meshMaterial.opacity = 1;
      instance.mesh.scale.setScalar(1 + progress * 0.5);
    } else {
      instance.meshMaterial.opacity = Math.max(0, 1 - (progress - 0.4) / 0.6);
      instance.mesh.scale.setScalar(1.2);
    }
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
