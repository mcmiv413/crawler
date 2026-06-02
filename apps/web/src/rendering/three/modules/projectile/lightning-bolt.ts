/**
 * Three.js module for `fx.projectile.lightning-bolt`.
 * Visual: bright electrical bolt traveling to target with electrical arcing trail.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createSoftGlow, type SoftGlow } from '../../lib/soft-glow.js';
import { createProjectileTrail, type ProjectileTrail } from '../../lib/projectile-trail.js';
import { createParticleBurst, type ParticleBurst } from '../../lib/particle-burst.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly coreMesh: THREE.Mesh;
  readonly coreMaterial: THREE.MeshBasicMaterial;
  readonly glow: SoftGlow;
  readonly trail: ProjectileTrail;
  readonly burst: ParticleBurst;
  readonly tileSize: number;
  source: { x: number; y: number };
  target: { x: number; y: number };
  z: number;
}

export const lightningBolt: ThreeAnimationModule<Instance> = {
  id: animationRefs.projectile.lightningBolt.id,
  category: animationRefs.projectile.lightningBolt.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    // Core bolt mesh - thin bright vertical
    const coreGeo = new THREE.PlaneGeometry(tileSize * 0.08, tileSize * 0.25);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xddffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMaterial);
    group.add(coreMesh);

    // Electrical glow
    const glow = createSoftGlow({
      color: 0x6db8ff,
      radiusPx: tileSize * 0.4,
      opacity: 0.5,
    });
    group.add(glow.object);

    // Lightning trail with electrical color
    const trail = createProjectileTrail({
      lengthPx: tileSize * 0.6,
      widthPx: tileSize * 0.15,
      color: 0x6db8ff,
      opacity: 0.6,
      fadeStart: 0.7,
    });
    group.add(trail.object);

    // Spark burst on impact
    const burst = createParticleBurst({
      count: 16,
      spreadPx: tileSize * 0.7,
      startColor: 0xffffcc,
      endColor: 0x6db8ff,
      gravityPx: tileSize * 0.2,
      sizePx: tileSize * 0.08,
      seed: 304,
      tileSize,
    });
    burst.object.visible = false;
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [coreGeo, trail.geometry, burst.geometry],
      materials: [coreMaterial, glow.material, trail.material, burst.material],
      coreMesh,
      coreMaterial,
      glow,
      trail,
      burst,
      tileSize,
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
    const { tileSize } = instance;
    const travelProgress = Math.min(progress / 0.8, 1);
    const x = instance.source.x + (instance.target.x - instance.source.x) * travelProgress;
    const y = instance.source.y + (instance.target.y - instance.source.y) * travelProgress;
    instance.group.position.set(x, y, instance.z);

    instance.trail.update(progress);

    // Calculate direction for rotation
    const dx = instance.target.x - instance.source.x;
    const dy = instance.target.y - instance.source.y;
    const angle = Math.atan2(dy, dx);
    instance.coreMesh.rotation.z = angle - Math.PI / 2;

    if (progress < 0.8) {
      // Travel phase
      instance.coreMesh.scale.setScalar(1);
      instance.coreMaterial.opacity = 1;
      instance.glow.setOpacity(0.5);
      instance.burst.object.visible = false;

      // Slight rotation oscillation for electrical effect
      instance.coreMesh.rotation.z += Math.sin(progress * Math.PI * 6) * 0.03;
    } else {
      // Impact phase
      const t = (progress - 0.8) / 0.2;
      instance.group.position.set(instance.target.x, instance.target.y, instance.z);
      instance.coreMesh.scale.setScalar(1 + t * 1.5);
      instance.coreMaterial.opacity = 1 - t;
      instance.glow.setScale(tileSize * (0.4 + t * 0.6));
      instance.glow.setOpacity(0.5 * (1 - t));
      instance.burst.update(t);
      instance.burst.object.visible = true;
    }
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.glow.dispose();
    instance.trail.dispose();
    instance.burst.dispose();
  },
};
