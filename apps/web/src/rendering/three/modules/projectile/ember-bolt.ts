/**
 * Three.js module for `fx.projectile.ember-bolt`.
 * Visual: a glowing orange-red orb that travels and fades on impact.
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

export const emberBolt: ThreeAnimationModule<Instance> = {
  id: animationRefs.projectile.emberBolt.id,
  category: animationRefs.projectile.emberBolt.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.CircleGeometry(tileSize * 0.3, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff5500,
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
    // Impact burst at 0.8, then fade
    if (progress >= 0.8) {
      const t = (progress - 0.8) / 0.2;
      instance.mesh.scale.setScalar(1 + t * 2);
      instance.material.opacity = Math.max(0, 1 - t);
    }
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
