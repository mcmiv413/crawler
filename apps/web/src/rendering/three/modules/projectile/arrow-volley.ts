/**
 * Three.js module for `fx.projectile.arrow-volley`.
 * Visual: three arrows traveling in formation with trails and impact burst.
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
  readonly arrowMeshes: THREE.Mesh[];
  readonly arrowMaterials: THREE.MeshBasicMaterial[];
  readonly trails: ProjectileTrail[];
  readonly burst: ParticleBurst;
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

    const arrowMeshes: THREE.Mesh[] = [];
    const arrowMaterials: THREE.MeshBasicMaterial[] = [];
    const trails: ProjectileTrail[] = [];
    const arrowGeos: THREE.PlaneGeometry[] = [];
    const offsets = [-tileSize * 0.4, 0, tileSize * 0.4];

    for (const xOff of offsets) {
      const geo = new THREE.PlaneGeometry(tileSize * 0.2, tileSize);
      const mat = new THREE.MeshBasicMaterial({ color: 0xcc9933, transparent: true, opacity: 1, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = xOff;
      group.add(mesh);
      arrowMeshes.push(mesh);
      arrowMaterials.push(mat);
      arrowGeos.push(geo);

      const trail = createProjectileTrail({ lengthPx: tileSize * 0.85, widthPx: tileSize * 0.16, color: 0xcc9933, opacity: 0.35, fadeStart: 0.75 });
      trail.object.position.x = xOff;
      group.add(trail.object);
      trails.push(trail);
    }

    const burst = createParticleBurst({ count: 18, spreadPx: tileSize * 0.8, startColor: 0xffdd88, endColor: 0xaa7722, gravityPx: tileSize * 0.15, sizePx: tileSize * 0.075, seed: 302, tileSize });
    burst.object.visible = false;
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [...arrowGeos, ...trails.map((t) => t.geometry), burst.geometry],
      materials: [...arrowMaterials, ...trails.map((t) => t.material), burst.material],
      arrowMeshes,
      arrowMaterials,
      trails,
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
    const travelProgress = Math.min(progress / 0.78, 1);
    const x = instance.source.x + (instance.target.x - instance.source.x) * travelProgress;
    const y = instance.source.y + (instance.target.y - instance.source.y) * travelProgress;
    instance.group.position.set(x, y, instance.z);

    const dx = instance.target.x - instance.source.x;
    const dy = instance.target.y - instance.source.y;
    if (dx !== 0 || dy !== 0) {
      instance.group.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }

    const arrowOpacity = progress > 0.75 ? Math.max(0, 1 - (progress - 0.75) / 0.25) : 1;
    for (const mat of instance.arrowMaterials) {
      mat.opacity = arrowOpacity;
    }

    for (const trail of instance.trails) {
      trail.update(progress);
    }

    const burstProgress = progress < 0.78 ? 0 : (progress - 0.78) / 0.22;
    instance.burst.object.visible = progress >= 0.78;
    instance.burst.update(burstProgress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    for (const geo of instance.geometries.slice(0, 3)) geo.dispose();
    for (const mat of instance.arrowMaterials) mat.dispose();
    for (const trail of instance.trails) trail.dispose();
    instance.burst.dispose();
  },
};
