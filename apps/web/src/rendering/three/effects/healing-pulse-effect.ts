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
import type {
  ThreeEffectModule,
  ThreeEffectContext,
  ThreeEffectScreenPosition,
} from '../three-effect-types.js';

const HEALING_GREEN = 0x44ff88;
const BASE_RADIUS_TILES = 0.45;
const SEGMENTS = 32;

interface HealingPulseInstance {
  group: THREE.Group;
  mesh: THREE.Mesh;
  geometry: THREE.CircleGeometry;
  material: THREE.MeshBasicMaterial;
  scene: ThreeEffectContext['scene'];
  canvasHeight: number;
}

export const healingPulseEffect: ThreeEffectModule<HealingPulseInstance> = {
  create(context: ThreeEffectContext): HealingPulseInstance {
    const geometry = new THREE.CircleGeometry(BASE_RADIUS_TILES, SEGMENTS);
    const material = new THREE.MeshBasicMaterial({
      color: HEALING_GREEN,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    // Initial mesh scale: 0.2 (grows to 1.0 in update)
    mesh.scale.setScalar(0.2);

    const group = new THREE.Group();
    group.add(mesh);
    // Scale from tile-relative units into pixel space so the final pulse spans
    // roughly 90% of a tile, which remains visible on the 24px viewport grid.
    group.scale.setScalar(context.tileSize);

    context.scene.add(group);

    return {
      group,
      mesh,
      geometry,
      material,
      scene: context.scene,
      canvasHeight: context.canvasHeight,
    };
  },

  setPosition(effect: HealingPulseInstance, position: ThreeEffectScreenPosition): void {
    effect.group.position.set(position.x, effect.canvasHeight - position.y, position.z);
  },

  update(effect: HealingPulseInstance, progress: number): void {
    if (progress <= 0.5) {
      // Grow from 0.2 to 1.0
      const t = progress / 0.5;
      const scale = 0.2 + t * 0.8;
      effect.mesh.scale.setScalar(scale);
      effect.material.opacity = 1;
    } else {
      // Hold scale at 1.0, fade out
      effect.mesh.scale.setScalar(1.0);
      const t = (progress - 0.5) / 0.5;
      effect.material.opacity = 1 - t;
    }
  },

  dispose(effect: HealingPulseInstance): void {
    effect.scene.remove(effect.group);
    effect.geometry.dispose();
    effect.material.dispose();
  },
};
