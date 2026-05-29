/**
 * Three.js module for `fx.aoe.shatter-burst`.
 * Visual: icy burst expanding outward over an area.
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

export const shatterBurst: ThreeAnimationModule<Instance> = {
  id: animationRefs.aoe.shatterBurst.id,
  category: animationRefs.aoe.shatterBurst.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.CircleGeometry(tileSize * 0.45, 24);
    const material = new THREE.MeshBasicMaterial({
      color: 0xaaddff,
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
    const scale = 0.3 + progress * 2;
    instance.mesh.scale.setScalar(scale);
    instance.material.opacity = Math.max(0, 1 - progress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
