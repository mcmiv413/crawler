/**
 * Three.js module for `fx.aoe.bomb-blast`.
 * Visual: large expanding circle burst.
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

export const bombBlast: ThreeAnimationModule<Instance> = {
  id: animationRefs.aoe.bombBlast.id,
  category: animationRefs.aoe.bombBlast.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.CircleGeometry(tileSize * 0.5, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.1);
    ctx.scene.add(mesh);
    return { mesh, geometry, material, scene: ctx.scene };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.mesh.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    // Rapid expand then fade
    const scale = 0.1 + progress * 2.5;
    instance.mesh.scale.setScalar(scale);
    instance.material.opacity = progress < 0.3 ? 1 : Math.max(0, 1 - (progress - 0.3) / 0.7);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
