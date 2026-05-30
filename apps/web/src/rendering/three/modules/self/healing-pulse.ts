/**
 * Three.js module for `fx.self.healing-pulse`.
 * Visual: green circle expanding with glow, shockwave ring, and rising motes.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createSoftGlow, type SoftGlow } from '../../lib/soft-glow.js';
import { createShockwaveRing, type ShockwaveRing } from '../../lib/shockwave-ring.js';
import { createParticleBurst, type ParticleBurst } from '../../lib/particle-burst.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly mesh: THREE.Mesh;
  readonly meshMaterial: THREE.MeshBasicMaterial;
  readonly glow: SoftGlow;
  readonly ring: ShockwaveRing;
  readonly burst: ParticleBurst;
}

export const healingPulse: ThreeAnimationModule<Instance> = {
  id: animationRefs.self.healingPulse.id,
  category: animationRefs.self.healingPulse.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const circleGeo = new THREE.CircleGeometry(tileSize * 0.45, 32);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(circleGeo, meshMaterial);
    mesh.scale.setScalar(0.2);
    group.add(mesh);

    const glow = createSoftGlow({ color: 0x44ff88, radiusPx: tileSize * 0.65, opacity: 0.65 });
    const ring = createShockwaveRing({ innerRadiusPx: tileSize * 0.25, outerRadiusPx: tileSize * 0.48, color: 0x44ff88, startScale: 0.2, endScale: 1, opacity: 0.8, fadeStart: 0.5 });
    const burst = createParticleBurst({ count: 18, spreadPx: tileSize * 0.65, startColor: 0x88ffaa, endColor: 0x44ff88, gravityPx: -tileSize * 0.45, sizePx: tileSize * 0.08, lifetimeJitter: 0.3, seed: 401, tileSize });

    group.add(glow.object);
    group.add(ring.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [circleGeo, ring.geometry, burst.geometry],
      materials: [meshMaterial, glow.material, ring.material, burst.material],
      mesh,
      meshMaterial,
      glow,
      ring,
      burst,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    if (progress < 0.5) {
      instance.mesh.scale.setScalar(0.2 + progress * 1.6);
      instance.meshMaterial.opacity = 1;
    } else {
      instance.mesh.scale.setScalar(1);
      instance.meshMaterial.opacity = Math.max(0, 1 - (progress - 0.5) * 2);
    }
    instance.ring.update(progress);
    instance.burst.update(progress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.glow.dispose();
    instance.ring.dispose();
    instance.burst.dispose();
  },
};
