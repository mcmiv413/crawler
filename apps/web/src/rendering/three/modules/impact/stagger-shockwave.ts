/**
 * Three.js module for `fx.impact.stagger-shockwave`.
 * Visual: expanding ring shockwave.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  mesh: THREE.Mesh;
  geometry: THREE.RingGeometry;
  material: THREE.MeshBasicMaterial;
  scene: ThreeAnimationContext['scene'];
  tileSize: number;
}

export const staggerShockwave: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.staggerShockwave.id,
  category: animationRefs.impact.staggerShockwave.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.RingGeometry(tileSize * 0.1, tileSize * 0.4, 24);
    const material = new THREE.MeshBasicMaterial({
      color: 0xaaaaff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    ctx.scene.add(mesh);
    return { mesh, geometry, material, scene: ctx.scene, tileSize };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.mesh.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    const scale = 1 + progress * 2;
    instance.mesh.scale.setScalar(scale);
    instance.material.opacity = 1 - progress;
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
