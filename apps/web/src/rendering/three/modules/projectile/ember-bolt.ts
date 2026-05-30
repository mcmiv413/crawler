/**
 * Three.js module for `fx.projectile.ember-bolt`.
 * Visual: glowing orb traveling to target and exploding on impact.
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

export const emberBolt: ThreeAnimationModule<Instance> = {
  id: animationRefs.projectile.emberBolt.id,
  category: animationRefs.projectile.emberBolt.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const coreGeo = new THREE.CircleGeometry(tileSize * 0.3, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 1, depthWrite: false });
    const coreMesh = new THREE.Mesh(coreGeo, coreMaterial);
    group.add(coreMesh);

    const glow = createSoftGlow({ color: 0xff5500, radiusPx: tileSize * 0.45, opacity: 0.65 });
    group.add(glow.object);

    const trail = createProjectileTrail({ lengthPx: tileSize * 0.8, widthPx: tileSize * 0.25, color: 0xff5500, opacity: 0.5, fadeStart: 0.8 });
    group.add(trail.object);

    const burst = createParticleBurst({ count: 20, spreadPx: tileSize * 0.85, startColor: 0xffcc55, endColor: 0xff3300, gravityPx: tileSize * 0.25, sizePx: tileSize * 0.1, seed: 303, tileSize });
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

    if (progress < 0.8) {
      instance.coreMesh.scale.setScalar(1);
      instance.coreMaterial.opacity = 1;
      instance.glow.setOpacity(0.65);
      instance.burst.object.visible = false;
    } else {
      const t = (progress - 0.8) / 0.2;
      instance.group.position.set(instance.target.x, instance.target.y, instance.z);
      instance.coreMesh.scale.setScalar(1 + t * 2);
      instance.coreMaterial.opacity = 1 - t;
      instance.glow.setScale(tileSize * (0.45 + t * 0.75));
      instance.glow.setOpacity(0.65 * (1 - t));
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
