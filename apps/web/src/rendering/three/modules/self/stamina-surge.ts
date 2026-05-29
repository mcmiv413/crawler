/**
 * Three.js module for `fx.self.stamina-surge`.
 * Visual: yellow burst expanding outward.
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

export const staminaSurge: ThreeAnimationModule<Instance> = {
  id: animationRefs.self.staminaSurge.id,
  category: animationRefs.self.staminaSurge.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.CircleGeometry(tileSize * 0.4, 24);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.3);
    ctx.scene.add(mesh);
    return { mesh, geometry, material, scene: ctx.scene };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.mesh.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    const scale = 0.3 + progress * 1.2;
    instance.mesh.scale.setScalar(scale);
    instance.material.opacity = Math.max(0, 1 - progress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
