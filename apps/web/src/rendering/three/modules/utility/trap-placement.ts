/**
 * Three.js module for `fx.utility.trap-placement`.
 * Visual: dim pulsing indicator showing a trap being placed.
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

export const trapPlacement: ThreeAnimationModule<Instance> = {
  id: animationRefs.utility.trapPlacement.id,
  category: animationRefs.utility.trapPlacement.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.PlaneGeometry(tileSize, tileSize);
    const material = new THREE.MeshBasicMaterial({
      color: 0x886600,
      transparent: true,
      opacity: 0.6,
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
    // Slow pulse in then solidify
    instance.material.opacity = 0.3 + Math.sin(progress * Math.PI) * 0.3;
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
