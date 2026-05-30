import * as THREE from 'three';
import { clamp01, easeOutCubic } from './easing.js';

export interface ParticleBurstOptions {
  readonly count: number;
  readonly spreadPx: number;
  readonly startColor: THREE.ColorRepresentation;
  readonly endColor?: THREE.ColorRepresentation;
  readonly gravityPx?: number;
  readonly sizePx?: number;
  readonly lifetimeJitter?: number;
  readonly additive?: boolean;
  readonly seed?: number;
  readonly tileSize: number;
}

export interface ParticleBurst {
  readonly object: THREE.Points;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.PointsMaterial;
  update(progress: number): void;
  dispose(): void;
}

const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_MOD = 0x100000000;

function lcgNext(state: number): number {
  return ((state * LCG_A + LCG_C) >>> 0) % LCG_MOD;
}

function lcgFloat(state: number): number {
  return state / LCG_MOD;
}

export function createParticleBurst(options: ParticleBurstOptions): ParticleBurst {
  const {
    count,
    spreadPx,
    startColor,
    tileSize,
  } = options;

  const endColor = options.endColor ?? startColor;
  const gravityPx = options.gravityPx ?? 0;
  const sizePx = options.sizePx ?? tileSize * 0.12;
  const lifetimeJitter = Math.min(Math.max(options.lifetimeJitter ?? 0.2, 0), 0.95);
  const additive = options.additive ?? true;
  const seed = options.seed ?? 1;

  // Precompute per-particle properties using LCG
  const angles = new Float32Array(count);
  const speeds = new Float32Array(count);
  const delays = new Float32Array(count);

  let rng = seed;
  for (let i = 0; i < count; i++) {
    rng = lcgNext(rng);
    angles[i] = lcgFloat(rng) * Math.PI * 2;

    rng = lcgNext(rng);
    speeds[i] = 0.45 + lcgFloat(rng) * 0.55; // [0.45, 1]

    rng = lcgNext(rng);
    delays[i] = lcgFloat(rng) * lifetimeJitter; // [0, lifetimeJitter]
  }

  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const startColorObj = new THREE.Color(startColor);
  const endColorObj = new THREE.Color(endColor);

  const material = new THREE.PointsMaterial({
    color: startColorObj,
    size: sizePx,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const object = new THREE.Points(geometry, material);

  let disposed = false;

  function update(progress: number): void {
    const p = clamp01(progress);
    const posAttr = geometry.attributes['position']!;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const delay = delays[i]!;
      const local = clamp01((p - delay) / (1 - delay));
      const eased = easeOutCubic(local);
      const speed = speeds[i]!;

      posArray[i * 3] = Math.cos(angles[i]!) * spreadPx * speed * eased;
      posArray[i * 3 + 1] =
        Math.sin(angles[i]!) * spreadPx * speed * eased - gravityPx * local * local;
      posArray[i * 3 + 2] = 0;
    }

    posAttr.needsUpdate = true;
    material.opacity = 1 - p;

    const colorT = p;
    material.color.set(startColorObj).lerp(endColorObj, colorT);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    geometry.dispose();
    material.dispose();
  }

  return { object, geometry, material, update, dispose };
}
