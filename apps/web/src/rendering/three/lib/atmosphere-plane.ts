import * as THREE from 'three';

export interface AtmosphereVignetteOptions {
  readonly width: number;
  readonly height: number;
  readonly color?: THREE.ColorRepresentation;
  readonly edgeOpacity?: number;
  readonly innerRadiusFraction?: number;
}

export interface AtmosphereVignette {
  readonly object: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly material: THREE.MeshBasicMaterial;
  readonly texture: THREE.CanvasTexture | null;
  setSize(width: number, height: number): void;
  setOpacity(opacity: number): void;
  dispose(): void;
}

const TEXTURE_SIZE = 256;
const DEFAULT_COLOR = 0x000000;
const DEFAULT_EDGE_OPACITY = 0.42;
const DEFAULT_INNER_RADIUS_FRACTION = 0.55;

function clampUnit(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function buildAtmosphereTexture(innerRadiusFraction: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }

  if (ctx === null) {
    return null;
  }

  const center = TEXTURE_SIZE / 2;
  const outerRadius = Math.hypot(center, center);
  const clampedInnerRadius = Math.min(
    Math.max(innerRadiusFraction, 0),
    0.999,
  ) * outerRadius;
  const gradient = ctx.createRadialGradient(
    center,
    center,
    clampedInnerRadius,
    center,
    center,
    outerRadius,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(1, 'rgba(255,255,255,1)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  return new THREE.CanvasTexture(canvas);
}

export function createAtmosphereVignette(options: AtmosphereVignetteOptions): AtmosphereVignette {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const texture = buildAtmosphereTexture(
    options.innerRadiusFraction ?? DEFAULT_INNER_RADIUS_FRACTION,
  );

  const materialParams: THREE.MeshBasicMaterialParameters = {
    color: options.color ?? DEFAULT_COLOR,
    transparent: true,
    depthWrite: false,
    opacity: clampUnit(options.edgeOpacity ?? DEFAULT_EDGE_OPACITY),
    blending: THREE.NormalBlending,
  };

  if (texture !== null) {
    materialParams.map = texture;
  }

  const material = new THREE.MeshBasicMaterial(materialParams);
  const object = new THREE.Mesh(geometry, material);
  object.renderOrder = -100;

  let disposed = false;

  const vignette: AtmosphereVignette = {
    object,
    material,
    texture,

    setSize(width: number, height: number): void {
      object.scale.set(width, height, 1);
      object.position.set(width / 2, height / 2, -1);
    },

    setOpacity(opacity: number): void {
      material.opacity = clampUnit(opacity);
    },

    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      geometry.dispose();
      material.dispose();
      texture?.dispose();
    },
  };

  vignette.setSize(options.width, options.height);
  vignette.setOpacity(options.edgeOpacity ?? DEFAULT_EDGE_OPACITY);

  return vignette;
}
