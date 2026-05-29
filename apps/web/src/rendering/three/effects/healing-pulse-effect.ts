/**
 * Three.js effect module for `fx.self.healing-pulse`.
 *
 * Visual: a green circle that expands outward and fades to transparent
 * as progress approaches 1.
 *
 * Progress contract:
 *   0.0 – 0.5  scale grows from 0.2 → 1.0, opacity stays at 1
 *   0.5 – 1.0  scale stays at 1.0, opacity fades from 1 → 0
 */

import * as THREE from 'three';
import type { ThreeEffectModule, ThreeEffectContext } from '../three-effect-types.js';

const HEALING_GREEN = 0x44ff88;
const BASE_RADIUS = 0.4;
const SEGMENTS = 32;

interface HealingPulseInstance {
  group: THREE.Group;
  mesh: THREE.Mesh;
  geometry: THREE.CircleGeometry;
  material: THREE.MeshBasicMaterial;
  scene: THREE.Scene;
}

export const healingPulseEffect: ThreeEffectModule = {
  create(context: ThreeEffectContext): HealingPulseInstance {
    const geometry = new THREE.CircleGeometry(BASE_RADIUS, SEGMENTS);
    const material = new THREE.MeshBasicMaterial({
      color: HEALING_GREEN,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.2);

    const group = new THREE.Group();
    group.add(mesh);

    context.scene.add(group);

    return { group, mesh, geometry, material, scene: context.scene };
  },

  update(effect: unknown, progress: number): void {
    const inst = effect as HealingPulseInstance;

    if (progress <= 0.5) {
      // Grow from 0.2 to 1.0
      const t = progress / 0.5;
      const scale = 0.2 + t * 0.8;
      inst.mesh.scale.setScalar(scale);
      inst.material.opacity = 1;
    } else {
      // Hold scale at 1.0, fade out
      inst.mesh.scale.setScalar(1.0);
      const t = (progress - 0.5) / 0.5;
      inst.material.opacity = 1 - t;
    }
  },

  dispose(effect: unknown): void {
    const inst = effect as HealingPulseInstance;
    inst.scene.remove(inst.group);
    inst.geometry.dispose();
    inst.material.dispose();
  },
};
