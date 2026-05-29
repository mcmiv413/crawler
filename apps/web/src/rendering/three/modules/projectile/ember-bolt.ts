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
  source: { x: number; y: number };
  target: { x: number; y: number };
  z: number;
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
    return {
      mesh,
      geometry,
      material,
      scene: ctx.scene,
      source: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      z: 0,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.source = pos.source ?? { x: pos.x, y: pos.y };
    instance.target = pos.target ?? { x: pos.x, y: pos.y };
    instance.z = pos.z;
  },

  update(instance: Instance, progress: number): void {
    const impactStart = 0.8;
    const travelProgress = Math.min(progress / impactStart, 1);
    const x = instance.source.x + (instance.target.x - instance.source.x) * travelProgress;
    const y = instance.source.y + (instance.target.y - instance.source.y) * travelProgress;
    instance.mesh.position.set(x, y, instance.z);
    instance.mesh.scale.setScalar(1);
    instance.material.opacity = 1;

    if (progress >= impactStart) {
      const t = (progress - impactStart) / (1 - impactStart);
      instance.mesh.position.set(instance.target.x, instance.target.y, instance.z);
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
