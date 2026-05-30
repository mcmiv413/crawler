/**
 * Three.js module for `fx.status.gold-ring-pulse`.
 * Visual: gold ring that pulses while a status is active, with soft glow.
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

export const goldRingPulse: ThreeAnimationModule<Instance> = {
  id: animationRefs.status.goldRingPulse.id,
  category: animationRefs.status.goldRingPulse.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(tileSize * 0.35, tileSize * 0.5, 32);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ringGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xffcc00, radiusPx: tileSize * 0.62, opacity: 0.22 });
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
    const ringOpacity = 0.5 + Math.sin(progress * Math.PI) * 0.5;
    instance.meshMaterial.opacity = ringOpacity;
    instance.mesh.scale.setScalar(0.9 + Math.sin(progress * Math.PI) * 0.1);
    instance.glow.setOpacity(ringOpacity * 0.22);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.glow.dispose();
  },
};
