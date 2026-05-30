/**
 * Three.js module for `fx.status.heat-surge-ring`.
 * Visual: orange pulsing ring with soft glow indicating heat surge.
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

export const heatSurgeRing: ThreeAnimationModule<Instance> = {
  id: animationRefs.status.heatSurgeRing.id,
  category: animationRefs.status.heatSurgeRing.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(tileSize * 0.32, tileSize * 0.54, 32);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0xff6020, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ringGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xff6020, radiusPx: tileSize * 0.66, opacity: 0.25 });
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
    const pulse = 0.75 + Math.sin(progress * Math.PI * 2) * 0.2;
    const ringOpacity = 0.55 + Math.sin(progress * Math.PI * 2) * 0.25;
    instance.meshMaterial.opacity = ringOpacity;
    instance.mesh.scale.setScalar(pulse);
    instance.glow.setOpacity(ringOpacity * 0.25);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.glow.dispose();
  },
};
