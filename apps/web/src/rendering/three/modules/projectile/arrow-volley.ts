/**
 * Three.js module for `fx.projectile.arrow-volley`.
 * Visual: multiple overlapping arrow planes that fade together.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  scene: ThreeAnimationContext['scene'];
  geometries: THREE.PlaneGeometry[];
}

export const arrowVolley: ThreeAnimationModule<Instance> = {
  id: animationRefs.projectile.arrowVolley.id,
  category: animationRefs.projectile.arrowVolley.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();
    const materials: THREE.MeshBasicMaterial[] = [];
    const geometries: THREE.PlaneGeometry[] = [];
    const offsets = [-tileSize * 0.4, 0, tileSize * 0.4];

    for (const xOff of offsets) {
      const geometry = new THREE.PlaneGeometry(tileSize * 0.2, tileSize);
      const material = new THREE.MeshBasicMaterial({
        color: 0xcc9933,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.x = xOff;
      group.add(mesh);
      materials.push(material);
      geometries.push(geometry);
    }

    ctx.scene.add(group);
    return { group, materials, scene: ctx.scene, geometries };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    const opacity = progress > 0.75 ? Math.max(0, 1 - (progress - 0.75) / 0.25) : 1;
    for (const mat of instance.materials) {
      mat.opacity = opacity;
    }
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    for (const geo of instance.geometries) geo.dispose();
    for (const mat of instance.materials) mat.dispose();
  },
};
