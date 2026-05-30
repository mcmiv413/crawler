/**
 * Three.js module for `fx.impact.bleeding-strike`.
 * Visual: red splash that drips down, with glow and blood particles.
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
  readonly tileSize: number;
}

export const bleedingStrike: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.bleedingStrike.id,
  category: animationRefs.impact.bleedingStrike.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const splashGeo = new THREE.PlaneGeometry(tileSize, tileSize);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xcc0000, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(splashGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xcc0000, radiusPx: tileSize * 0.65, opacity: 0.35 });
    const burst = createParticleBurst({ count: 18, spreadPx: tileSize * 0.8, startColor: 0xff2222, endColor: 0x660000, gravityPx: tileSize * 0.5, sizePx: tileSize * 0.1, seed: 201, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [splashGeo, burst.geometry],
      materials: [meshMaterial, glow.material, burst.material],
      mesh,
      meshMaterial,
      glow,
      burst,
      tileSize,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    instance.mesh.position.y = -progress * instance.tileSize * 0.25;
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
