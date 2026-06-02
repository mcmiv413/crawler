/**
 * Three.js module for `fx.impact.lightning-strike`.
 * Visual: vertical electrical discharge with branching paths and electrical glow.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createSoftGlow, type SoftGlow } from '../../lib/soft-glow.js';
import { createParticleBurst, type ParticleBurst } from '../../lib/particle-burst.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly mainBolt: THREE.Mesh;
  readonly mainMaterial: THREE.MeshBasicMaterial;
  readonly glow: SoftGlow;
  readonly burst: ParticleBurst;
}

/**
 * Creates a jagged lightning bolt line using a custom geometry.
 * Returns a geometry that can be used with a LineBasicMaterial.
 */
function createLightningGeometry(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  segments: number,
  variance: number,
  seed: number
): THREE.BufferGeometry {
  const points: number[] = [];
  points.push(startX, startY, 0);

  // Pseudo-random jagging based on position and seed
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const baseX = startX + (endX - startX) * t;
    const baseY = startY + (endY - startY) * t;

    // Deterministic jagging using seed
    const jag = Math.sin(baseY * 0.05 + seed) * variance * (1 - Math.abs(t - 0.5) * 2);
    points.push(baseX + jag, baseY, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));

  return geometry;
}

export const lightningStrike: ThreeAnimationModule<Instance> = {
  id: animationRefs.impact.lightningStrike.id,
  category: animationRefs.impact.lightningStrike.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    // Main vertical strike bolt mesh
    const boltGeo = new THREE.PlaneGeometry(tileSize * 0.15, tileSize * 0.8);
    const boltMaterial = new THREE.MeshBasicMaterial({
      color: 0xccddff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mainBolt = new THREE.Mesh(boltGeo, boltMaterial);
    group.add(mainBolt);

    // Electrical glow
    const glow = createSoftGlow({ color: 0x6db8ff, radiusPx: tileSize * 0.6, opacity: 0.4 });
    group.add(glow.object);

    // Particle burst for spark effects
    const burst = createParticleBurst({
      count: 12,
      spreadPx: tileSize * 0.7,
      startColor: 0xffffcc,
      endColor: 0x6db8ff,
      gravityPx: tileSize * 0.15,
      sizePx: tileSize * 0.06,
      seed: 301,
      tileSize,
    });
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [boltGeo, burst.geometry],
      materials: [boltMaterial, glow.material, burst.material],
      mainBolt,
      mainMaterial: boltMaterial,
      glow,
      burst,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    // Lightning primarily visible in first 25% of animation
    let alpha: number;
    if (progress < 0.25) {
      alpha = 1;
    } else if (progress < 0.5) {
      alpha = 1 - (progress - 0.25) / 0.25;
    } else {
      alpha = 0;
    }

    instance.mainMaterial.opacity = alpha;

    // Slight rotation oscillation for electrical effect
    instance.mainBolt.rotation.z = Math.sin(progress * Math.PI * 4) * 0.05;

    instance.glow.material.opacity = alpha * 0.4;

    // Scale effect during impact
    const scale = 1 + Math.sin(progress * Math.PI) * 0.1;
    instance.mainBolt.scale.set(1, scale, 1);

    instance.burst.update(progress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries.forEach((g) => g.dispose());
    instance.materials.forEach((m) => m.dispose());
    instance.glow.dispose();
    instance.burst.dispose();
  },
};
