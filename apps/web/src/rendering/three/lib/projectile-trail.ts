import * as THREE from 'three';
import { clamp01, easeOutQuad } from './easing.js';

export interface ProjectileTrailOptions {
  readonly lengthPx: number;
  readonly widthPx: number;
  readonly color: THREE.ColorRepresentation;
  readonly opacity?: number;
  readonly fadeStart?: number;
  readonly additive?: boolean;
}

export interface ProjectileTrail {
  readonly object: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
  update(progress: number): void;
  dispose(): void;
}

export function createProjectileTrail(options: ProjectileTrailOptions): ProjectileTrail {
  const { lengthPx, widthPx, color } = options;
  const baseOpacity = options.opacity ?? 0.55;
  const fadeStart = options.fadeStart ?? 0.8;
  const additive = options.additive ?? true;

  const geometry = new THREE.PlaneGeometry(widthPx, lengthPx);

  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    depthWrite: false,
    opacity: baseOpacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const object = new THREE.Mesh(geometry, material);
  object.position.set(0, -lengthPx / 2, 0);

  let disposed = false;

  function update(progress: number): void {
    const p = clamp01(progress);

    // Scale y: 0.35 at p=0, reaches 1 by p=0.25 using easeOutQuad
    const scaleProgress = clamp01(p / 0.25);
    object.scale.y = 0.35 + (1 - 0.35) * easeOutQuad(scaleProgress);

    // Opacity: base until fadeStart, then linearly fade to 0 by p=1
    if (p <= fadeStart) {
      material.opacity = baseOpacity;
    } else {
      const fadeProgress = (p - fadeStart) / (1 - fadeStart);
      material.opacity = baseOpacity * (1 - fadeProgress);
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
