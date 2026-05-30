/**
 * Three.js module for `fx.self.heat-surge-aura`.
 * Visual: orange pulsing aura ring with glow and ember particles.
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

export const heatSurgeAura: ThreeAnimationModule<Instance> = {
  id: animationRefs.self.heatSurgeAura.id,
  category: animationRefs.self.heatSurgeAura.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(tileSize * 0.3, tileSize * 0.5, 24);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ringGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xff6600, radiusPx: tileSize * 0.75, opacity: 0.5 });
    const burst = createParticleBurst({ count: 18, spreadPx: tileSize * 0.75, startColor: 0xffaa44, endColor: 0xff3300, gravityPx: -tileSize * 0.25, sizePx: tileSize * 0.08, seed: 403, tileSize });

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
    const pulse = Math.sin(progress * Math.PI * 3) * 0.2 + 0.8;
    instance.meshMaterial.opacity = pulse * (1 - progress);
    instance.mesh.scale.setScalar(1 + progress * 0.3);
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
