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
import { createSoftGlow, type SoftGlow } from '../lib/soft-glow.js';

interface DocsExampleInstance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly mesh: THREE.Mesh;
  readonly meshMaterial: THREE.MeshBasicMaterial;
  readonly glow: SoftGlow;
}

export const docsExampleHealingPulse: ThreeAnimationModule<DocsExampleInstance> = {
  id: animationRefs.self.healingPulse.id,
  category: animationRefs.self.healingPulse.category,

  create(context: ThreeAnimationContext): DocsExampleInstance {
    const { tileSize } = context;
    const group = new THREE.Group();

    const geometry = new THREE.RingGeometry(
      tileSize * 0.25,
      tileSize * 0.45,
      24,
    );
    const meshMaterial = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0x44ff88, radiusPx: tileSize * 0.5, opacity: 0.6 });
    group.add(glow.object);

    context.scene.add(group);

    return {
      group,
      scene: context.scene,
      geometries: [geometry],
      materials: [meshMaterial, glow.material],
      mesh,
      meshMaterial,
      glow,
    };
  },

  setPosition(instance: DocsExampleInstance, position: ThreeAnimationPosition): void {
    instance.group.position.set(position.x, position.y, position.z);
  },

  update(instance: DocsExampleInstance, progress: number): void {
    instance.mesh.scale.setScalar(0.6 + progress * 0.6);
    instance.meshMaterial.opacity = 1 - progress * 0.85;
  },

  dispose(instance: DocsExampleInstance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.glow.dispose();
  },
};

export function docsExampleProjectileDistance(position: ThreeAnimationPosition): number {
  if (position.source === undefined || position.target === undefined) {
    return 0;
  }

  return Math.hypot(position.target.x - position.source.x, position.target.y - position.source.y);
}
