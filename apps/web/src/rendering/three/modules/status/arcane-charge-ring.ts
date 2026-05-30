/**
 * Three.js module for `fx.status.arcane-charge-ring`.
 * Visual: blue rotating ring with soft glow indicating arcane charge.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createSoftGlow, type SoftGlow } from '../../lib/soft-glow.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly mesh: THREE.Mesh;
  readonly meshMaterial: THREE.MeshBasicMaterial;
  readonly glow: SoftGlow;
}

export const arcaneChargeRing: ThreeAnimationModule<Instance> = {
  id: animationRefs.status.arcaneChargeRing.id,
  category: animationRefs.status.arcaneChargeRing.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(tileSize * 0.3, tileSize * 0.52, 40);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ringGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0x4aa3ff, radiusPx: tileSize * 0.65, opacity: 0.24 });
    group.add(glow.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [ringGeo],
      materials: [meshMaterial, glow.material],
      mesh,
      meshMaterial,
      glow,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    const pulse = 0.9 + Math.sin(progress * Math.PI * 2) * 0.12;
    const ringOpacity = 0.42 + Math.sin(progress * Math.PI * 2) * 0.22;
    instance.meshMaterial.opacity = ringOpacity;
    instance.mesh.rotation.z = progress * Math.PI * 0.35;
    instance.mesh.scale.setScalar(pulse);
    instance.glow.setOpacity(ringOpacity * 0.24);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.glow.dispose();
  },
};
