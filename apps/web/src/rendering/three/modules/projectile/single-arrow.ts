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
  source: { x: number; y: number };
  target: { x: number; y: number };
  z: number;
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
    const travelProgress = Math.min(progress / 0.82, 1);
    const x = instance.source.x + (instance.target.x - instance.source.x) * travelProgress;
    const y = instance.source.y + (instance.target.y - instance.source.y) * travelProgress;
    instance.mesh.position.set(x, y, instance.z);

    const dx = instance.target.x - instance.source.x;
    const dy = instance.target.y - instance.source.y;
    if (dx !== 0 || dy !== 0) {
      instance.mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }

    instance.material.opacity = progress > 0.82 ? Math.max(0, 1 - (progress - 0.82) / 0.18) : 1;
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
