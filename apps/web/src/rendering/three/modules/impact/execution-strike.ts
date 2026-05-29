/**
 * Three.js module for `fx.impact.execution-strike`.
 * Visual: a bright flash that pulses then fades.
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

export const executionStrike: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.executionStrike.id,
  category: animationRefs.impact.executionStrike.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.PlaneGeometry(tileSize * 1.2, tileSize * 1.2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff2200,
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
    // Flash at impact then fade
    if (progress < 0.4) {
      instance.material.opacity = 1;
      const scale = 1 + progress * 0.5;
      instance.mesh.scale.setScalar(scale);
    } else {
      instance.material.opacity = Math.max(0, 1 - (progress - 0.4) / 0.6);
    }
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
