/**
 * Three.js module for `fx.projectile.single-arrow`.
 * Visual: arrow traveling from source to target with trail and impact burst.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createProjectileTrail, type ProjectileTrail } from '../../lib/projectile-trail.js';
import { createParticleBurst, type ParticleBurst } from '../../lib/particle-burst.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly arrowMesh: THREE.Mesh;
  readonly arrowMaterial: THREE.MeshBasicMaterial;
  readonly trail: ProjectileTrail;
  readonly burst: ParticleBurst;
  source: { x: number; y: number };
  target: { x: number; y: number };
  z: number;
}

export const singleArrow: ThreeAnimationModule<Instance> = {
  id: animationRefs.projectile.singleArrow.id,
  category: animationRefs.projectile.singleArrow.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const arrowGeo = new THREE.PlaneGeometry(tileSize * 0.25, tileSize);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xcc9933, transparent: true, opacity: 1, depthWrite: false });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMaterial);
    group.add(arrowMesh);

    const trail = createProjectileTrail({ lengthPx: tileSize * 0.9, widthPx: tileSize * 0.18, color: 0xcc9933, opacity: 0.45, fadeStart: 0.82 });
    group.add(trail.object);

    const burst = createParticleBurst({ count: 10, spreadPx: tileSize * 0.55, startColor: 0xffdd88, endColor: 0xcc9933, gravityPx: tileSize * 0.1, sizePx: tileSize * 0.07, seed: 301, tileSize });
    burst.object.visible = false;
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [arrowGeo, trail.geometry, burst.geometry],
      materials: [arrowMaterial, trail.material, burst.material],
      arrowMesh,
      arrowMaterial,
      trail,
      burst,
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
    const travelProgress = Math.min(progress / 0.82, 1);
    const x = instance.source.x + (instance.target.x - instance.source.x) * travelProgress;
    const y = instance.source.y + (instance.target.y - instance.source.y) * travelProgress;
    instance.group.position.set(x, y, instance.z);

    const dx = instance.target.x - instance.source.x;
    const dy = instance.target.y - instance.source.y;
    if (dx !== 0 || dy !== 0) {
      instance.group.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }

    instance.arrowMaterial.opacity = progress > 0.82 ? Math.max(0, 1 - (progress - 0.82) / 0.18) : 1;
    instance.trail.update(progress);

    const burstProgress = progress < 0.82 ? 0 : (progress - 0.82) / 0.18;
    instance.burst.object.visible = progress >= 0.82;
    instance.burst.update(burstProgress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.trail.dispose();
    instance.burst.dispose();
  },
};
