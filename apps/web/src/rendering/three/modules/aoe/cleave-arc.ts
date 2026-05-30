/**
 * Three.js module for `fx.aoe.cleave-arc`.
 * Visual: wide blue sweep with shockwave ring, glow, and particles.
 */

import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';
import { createShockwaveRing, type ShockwaveRing } from '../../lib/shockwave-ring.js';
import { createSoftGlow, type SoftGlow } from '../../lib/soft-glow.js';
import { createParticleBurst, type ParticleBurst } from '../../lib/particle-burst.js';

interface Instance {
  readonly group: THREE.Group;
  readonly scene: ThreeAnimationContext['scene'];
  readonly geometries: Array<{ dispose(): void }>;
  readonly materials: Array<{ dispose(): void; map?: { dispose(): void } | null }>;
  readonly mesh: THREE.Mesh;
  readonly meshMaterial: THREE.MeshBasicMaterial;
  readonly ring: ShockwaveRing;
  readonly glow: SoftGlow;
  readonly burst: ParticleBurst;
}

export const cleaveArc: ThreeAnimationModule<Instance> = {
  id: animationRefs.aoe.cleaveArc.id,
  category: animationRefs.aoe.cleaveArc.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const group = new THREE.Group();

    const sweepGeo = new THREE.PlaneGeometry(tileSize * 2, tileSize);
    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x5599ff, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(sweepGeo, meshMaterial);
    group.add(mesh);

    const ring = createShockwaveRing({ innerRadiusPx: tileSize * 0.35, outerRadiusPx: tileSize * 0.65, color: 0x5599ff, startScale: 0.8, endScale: 1.6, opacity: 0.35, fadeStart: 0 });
    const glow = createSoftGlow({ color: 0x5599ff, radiusPx: tileSize * 1.15, opacity: 0.28 });
    const burst = createParticleBurst({ count: 12, spreadPx: tileSize * 1.0, startColor: 0x99ccff, endColor: 0x3355aa, gravityPx: 0, sizePx: tileSize * 0.09, seed: 103, tileSize });

    group.add(ring.object);
    group.add(glow.object);
    group.add(burst.object);

    ctx.scene.add(group);

    return {
      group,
      scene: ctx.scene,
      geometries: [sweepGeo, ring.geometry, burst.geometry],
      materials: [meshMaterial, ring.material, glow.material, burst.material],
      mesh,
      meshMaterial,
      ring,
      glow,
      burst,
    };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.group.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    instance.mesh.rotation.z = -progress * (Math.PI / 3);
    instance.meshMaterial.opacity = Math.max(0, 1 - progress * 1.2);
    instance.ring.update(progress);
    instance.burst.update(progress);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.group);
    instance.geometries[0]!.dispose();
    instance.materials[0]!.dispose();
    instance.ring.dispose();
    instance.glow.dispose();
    instance.burst.dispose();
  },
};
