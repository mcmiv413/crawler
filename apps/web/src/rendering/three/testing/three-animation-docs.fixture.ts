/**
 * Type-checked fixture that mirrors the public adding-animation guide.
 *
 * Keep this file aligned with docs/guides/adding-animation.md so doc examples
 * drift fails during src typecheck instead of surviving until runtime review.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type {
  ThreeAnimationContext,
  ThreeAnimationModule,
  ThreeAnimationPosition,
} from '../three-animation-types.js';

interface DocsExampleInstance {
  readonly scene: ThreeAnimationContext['scene'];
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.RingGeometry;
  readonly material: THREE.MeshBasicMaterial;
}

export const docsExampleHealingPulse: ThreeAnimationModule<DocsExampleInstance> = {
  id: animationRefs.self.healingPulse.id,
  category: animationRefs.self.healingPulse.category,

  create(context: ThreeAnimationContext): DocsExampleInstance {
    const geometry = new THREE.RingGeometry(
      context.tileSize * 0.25,
      context.tileSize * 0.45,
      24,
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    context.scene.add(mesh);
    return { scene: context.scene, mesh, geometry, material };
  },

  setPosition(instance: DocsExampleInstance, position: ThreeAnimationPosition): void {
    instance.mesh.position.set(position.x, position.y, position.z);
  },

  update(instance: DocsExampleInstance, progress: number): void {
    instance.mesh.scale.setScalar(0.6 + progress * 0.6);
    instance.material.opacity = 1 - progress * 0.85;
  },

  dispose(instance: DocsExampleInstance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};

export function docsExampleProjectileDistance(position: ThreeAnimationPosition): number {
  if (position.source === undefined || position.target === undefined) {
    return 0;
  }

  return Math.hypot(position.target.x - position.source.x, position.target.y - position.source.y);
}
