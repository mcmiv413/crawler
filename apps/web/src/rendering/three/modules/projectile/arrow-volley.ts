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
  source: { x: number; y: number };
  target: { x: number; y: number };
  z: number;
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
    return {
      group,
      materials,
      scene: ctx.scene,
      geometries,
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
    const travelProgress = Math.min(progress / 0.78, 1);
    const x = instance.source.x + (instance.target.x - instance.source.x) * travelProgress;
    const y = instance.source.y + (instance.target.y - instance.source.y) * travelProgress;
    instance.group.position.set(x, y, instance.z);

    const dx = instance.target.x - instance.source.x;
    const dy = instance.target.y - instance.source.y;
    if (dx !== 0 || dy !== 0) {
      instance.group.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }

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
