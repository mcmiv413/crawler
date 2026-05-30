import * as THREE from 'three';

export interface SoftGlowOptions {
  readonly color: THREE.ColorRepresentation;
  readonly radiusPx: number;
  readonly opacity?: number;
  readonly additive?: boolean;
}

export interface SoftGlow {
  readonly object: THREE.Sprite;
  readonly material: THREE.SpriteMaterial;
  readonly texture: THREE.CanvasTexture | null;
  setScale(radiusPx: number): void;
  setOpacity(opacity: number): void;
  dispose(): void;
}

function buildGlowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx) return null;

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

export function createSoftGlow(options: SoftGlowOptions): SoftGlow {
  const opacity = options.opacity ?? 1;
  const additive = options.additive ?? true;

  const texture = buildGlowTexture();

  const materialParams: THREE.SpriteMaterialParameters = {
    color: options.color,
    opacity,
    transparent: true,
    depthWrite: false,
  };
  if (texture) materialParams.map = texture;
  if (additive) materialParams.blending = THREE.AdditiveBlending;

  const material = new THREE.SpriteMaterial(materialParams);
  const object = new THREE.Sprite(material);

  let disposed = false;

  const glow: SoftGlow = {
    object,
    material,
    texture,

    setScale(radiusPx: number): void {
      object.scale.set(radiusPx * 2, radiusPx * 2, 1);
    },

    setOpacity(op: number): void {
      material.opacity = op < 0 ? 0 : op > 1 ? 1 : op;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      material.dispose();
      texture?.dispose();
    },
  };

  glow.setScale(options.radiusPx);

  return glow;
}
