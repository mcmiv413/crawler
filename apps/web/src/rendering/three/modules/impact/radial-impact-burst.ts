/**
 * Three.js module for `fx.impact.radial-impact-burst`.
 * Visual: a ring that expands outward and fades.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  mesh: THREE.Mesh;
  geometry: THREE.RingGeometry;
  material: THREE.MeshBasicMaterial;
  scene: ThreeAnimationContext['scene'];
  tileSize: number;
}

export const radialImpactBurst: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.radialImpactBurst.id,
  category: animationRefs.impact.radialImpactBurst.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.RingGeometry(tileSize * 0.2, tileSize * 0.5, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    ctx.scene.add(mesh);
    return { mesh, geometry, material, scene: ctx.scene, tileSize };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.mesh.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    const scale = 0.5 + progress * 0.5;
    instance.mesh.scale.setScalar(scale);
    instance.material.opacity = 1 - progress;
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
