/**
 * Three.js module for `fx.impact.riposte-glint`.
 * Visual: quick bright diamond glint with glow and sparkle particles.
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

export const riposteGlint: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.riposteGlint.id,
  category: animationRefs.impact.riposteGlint.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const diamondGeo = new THREE.PlaneGeometry(tileSize * 0.8, tileSize * 0.8);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(diamondGeo, meshMaterial);
    mesh.rotation.z = Math.PI / 4;
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xffffaa, radiusPx: tileSize * 0.6, opacity: 0.5 });
    const burst = createParticleBurst({ count: 10, spreadPx: tileSize * 0.6, startColor: 0xffffff, endColor: 0xffdd66, gravityPx: 0, sizePx: tileSize * 0.07, seed: 207, tileSize });

    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [diamondGeo, burst.geometry],
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
    const peak = 0.3;
    instance.meshMaterial.opacity = progress < peak
      ? progress / peak
      : Math.max(0, 1 - (progress - peak) / (1 - peak));
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
