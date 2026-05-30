/**
 * Three.js module for `fx.utility.trap-placement`.
 * Visual: dim pulsing indicator with glow showing a trap being placed.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createSoftGlow, type SoftGlow } from '../../lib/soft-glow.js';
import { easeOutBack } from '../../lib/easing.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly mesh: THREE.Mesh;
  readonly meshMaterial: THREE.MeshBasicMaterial;
  readonly glow: SoftGlow;
}

export const trapPlacement: ThreeAnimationModule<Instance> = {
  id: animationRefs.utility.trapPlacement.id,
  category: animationRefs.utility.trapPlacement.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const planeGeo = new THREE.PlaneGeometry(tileSize, tileSize);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x886600, transparent: true, opacity: 0.6, depthWrite: false });
    const mesh = new THREE.Mesh(planeGeo, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0xffcc00, radiusPx: tileSize * 0.55, opacity: 0.28 });
    group.add(glow.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [planeGeo],
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
    const opacity = 0.3 + Math.sin(progress * Math.PI) * 0.3;
    instance.meshMaterial.opacity = opacity;
    instance.mesh.scale.setScalar(0.7 + easeOutBack(progress) * 0.3);
    instance.glow.setOpacity(opacity * 0.4);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.glow.dispose();
  },
};
