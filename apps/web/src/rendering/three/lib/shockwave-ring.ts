import * as THREE from 'three';
import { easeOutCubic, lerp } from './easing.js';

export interface ShockwaveRingOptions {
  readonly innerRadiusPx: number;
  readonly outerRadiusPx: number;
  readonly color: THREE.ColorRepresentation;
  readonly startScale?: number;
  readonly endScale?: number;
  readonly opacity?: number;
  readonly fadeStart?: number;
  readonly segments?: number;
  readonly additive?: boolean;
}

export interface ShockwaveRing {
  readonly object: THREE.Mesh;
  readonly geometry: THREE.RingGeometry;
  readonly material: THREE.MeshBasicMaterial;
  update(progress: number): void;
  dispose(): void;
}

export function createShockwaveRing(options: ShockwaveRingOptions): ShockwaveRing {
  const {
    innerRadiusPx,
    outerRadiusPx,
    color,
    startScale = 0.5,
    endScale = 1.5,
    opacity = 1,
    fadeStart = 0,
    segments = 32,
    additive = true,
  } = options;

  const geometry = new THREE.RingGeometry(innerRadiusPx, outerRadiusPx, segments);
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const object = new THREE.Mesh(geometry, material);
  object.scale.setScalar(startScale);

  let disposed = false;

  function update(progress: number): void {
    const scale = lerp(startScale, endScale, easeOutCubic(progress));
    object.scale.setScalar(scale);

    if (progress <= fadeStart) {
      material.opacity = opacity;
    } else {
      const fadeRange = 1 - fadeStart;
      const fadeProgress = fadeRange > 0 ? (progress - fadeStart) / fadeRange : 1;
      material.opacity = opacity * (1 - fadeProgress);
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    geometry.dispose();
    material.dispose();
  }

  return { object, geometry, material, update, dispose };
}
