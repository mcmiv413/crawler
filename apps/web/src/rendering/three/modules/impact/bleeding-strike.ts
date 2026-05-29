/**
 * Three.js module for `fx.impact.bleeding-strike`.
 * Visual: red splash that drips down and fades.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  mesh: THREE.Mesh;
  geometry: THREE.PlaneGeometry;
  material: THREE.MeshBasicMaterial;
  scene: ThreeAnimationContext['scene'];
}

export const bleedingStrike: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.bleedingStrike.id,
  category: animationRefs.impact.bleedingStrike.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.PlaneGeometry(tileSize, tileSize);
    const material = new THREE.MeshBasicMaterial({
      color: 0xcc0000,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    ctx.scene.add(mesh);
    return { mesh, geometry, material, scene: ctx.scene };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.mesh.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    // Drip: move down slightly and fade
    instance.mesh.position.y -= progress * 0.5;
    instance.material.opacity = Math.max(0, 1 - progress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
