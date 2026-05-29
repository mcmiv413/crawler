/**
 * Three.js module for `fx.aoe.cinder-wake`.
 * Visual: trailing ember particles across an area.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  geometries: THREE.CircleGeometry[];
  scene: ThreeAnimationContext['scene'];
}

export const cinderWake: ThreeAnimationModule<Instance> = {
  id: animationRefs.aoe.cinderWake.id,
  category: animationRefs.aoe.cinderWake.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();
    const materials: THREE.MeshBasicMaterial[] = [];
    const geometries: THREE.CircleGeometry[] = [];
    const offsets: Array<[number, number]> = [
      [0, 0], [-tileSize * 0.5, tileSize * 0.3],
      [tileSize * 0.5, -tileSize * 0.3], [tileSize * 0.3, tileSize * 0.5],
    ];

    for (const [x, y] of offsets) {
      const geometry = new THREE.CircleGeometry(tileSize * 0.15, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, 0);
      group.add(mesh);
      materials.push(material);
      geometries.push(geometry);
    }

    ctx.scene.add(group);
    return { group, materials, geometries, scene: ctx.scene };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    const opacity = Math.max(0, 1 - progress);
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
