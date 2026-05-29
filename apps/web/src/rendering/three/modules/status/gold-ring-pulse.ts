/**
 * Three.js module for `fx.status.gold-ring-pulse`.
 * Visual: gold ring that pulses while a status is active.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  mesh: THREE.Mesh;
  geometry: THREE.RingGeometry;
  material: THREE.MeshBasicMaterial;
  scene: ThreeAnimationContext['scene'];
}

export const goldRingPulse: ThreeAnimationModule<Instance> = {
  id: animationRefs.status.goldRingPulse.id,
  category: animationRefs.status.goldRingPulse.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.RingGeometry(tileSize * 0.35, tileSize * 0.5, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    ctx.scene.add(mesh);
    return { mesh, geometry, material, scene: ctx.scene };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.mesh.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    // Pulse in and out
    instance.material.opacity = 0.5 + Math.sin(progress * Math.PI) * 0.5;
    const scale = 0.9 + Math.sin(progress * Math.PI) * 0.1;
    instance.mesh.scale.setScalar(scale);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
