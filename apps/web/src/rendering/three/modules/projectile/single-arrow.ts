/**
 * Three.js module for `fx.projectile.single-arrow`.
 * Visual: a thin elongated plane traveling toward target.
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

export const singleArrow: ThreeAnimationModule<Instance> = {
  id: animationRefs.projectile.singleArrow.id,
  category: animationRefs.projectile.singleArrow.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.PlaneGeometry(tileSize * 0.25, tileSize);
    const material = new THREE.MeshBasicMaterial({
      color: 0xcc9933,
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
    // Fade near end of travel
    instance.material.opacity = progress > 0.8 ? Math.max(0, 1 - (progress - 0.8) / 0.2) : 1;
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
