/**
 * Three.js module for `fx.self.healing-pulse`.
 * Visual: green circle that expands and fades.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  mesh: THREE.Mesh;
  geometry: THREE.CircleGeometry;
  material: THREE.MeshBasicMaterial;
  scene: ThreeAnimationContext['scene'];
}

export const healingPulse: ThreeAnimationModule<Instance> = {
  id: animationRefs.self.healingPulse.id,
  category: animationRefs.self.healingPulse.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.CircleGeometry(tileSize * 0.45, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.2);
    ctx.scene.add(mesh);
    return { mesh, geometry, material, scene: ctx.scene };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.mesh.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    if (progress < 0.5) {
      instance.mesh.scale.setScalar(0.2 + progress * 1.6);
      instance.material.opacity = 1;
    } else {
      instance.mesh.scale.setScalar(1);
      instance.material.opacity = Math.max(0, 1 - (progress - 0.5) * 2);
    }
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
