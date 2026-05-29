/**
 * Shared lifecycle contract test helper for ThreeAnimationModule implementations.
 *
 * Every Three animation module must satisfy these contracts:
 *  1. create() attaches to scene (scene.add called)
 *  2. setPosition() does not throw with valid screen positions
 *  3. update() accepts progress in [0, 1] without throwing
 *  4. dispose() removes from scene (scene.remove called)
 *  5. dispose() releases geometry and material (no GPU leaks)
 *  6. Geometry is tile-scale (width/height >= tileSize) — visible, not sub-pixel
 *
 * Usage in category test files:
 *
 *   import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
 *   import { myModule } from './my-module.js';
 *
 *   describe('myModule lifecycle', () => {
 *     runThreeAnimationContract(myModule);
 *   });
 */

import { it, expect, beforeEach, vi } from 'vitest';
import type { ThreeAnimationModule } from '../three-animation-types.js';
import { makeMockThreeRenderer, makeMockContext } from './mock-three-renderer.js';
import type { MockRendererHandle } from './mock-three-renderer.js';

function getGeometryVisibleSpan(instance: {
  geometry?: {
    parameters?: Record<string, unknown>;
  };
  geometries?: readonly {
    parameters?: Record<string, unknown>;
  }[];
}): number {
  const geometries = instance.geometry === undefined
    ? (instance.geometries ?? [])
    : [instance.geometry, ...(instance.geometries ?? [])];
  const spans: number[] = [];

  for (const geometry of geometries) {
    const parameters = geometry.parameters;
    if (parameters === undefined) {
      continue;
    }

    spans.push(
      ...[
        parameters.width,
        parameters.height,
        typeof parameters.radius === 'number' ? parameters.radius * 2 : undefined,
        typeof parameters.innerRadius === 'number' ? parameters.innerRadius * 2 : undefined,
        typeof parameters.outerRadius === 'number' ? parameters.outerRadius * 2 : undefined,
      ].filter((value): value is number => typeof value === 'number'),
    );
  }

  return spans.length === 0 ? 0 : Math.max(...spans);
}

export function assertThreeAnimationVisibility(
  instance: {
    geometry?: { parameters?: Record<string, unknown> };
    geometries?: readonly { parameters?: Record<string, unknown> }[];
    material?: { opacity?: number; visible?: boolean };
    materials?: readonly { opacity?: number; visible?: boolean }[];
    mesh?: { visible?: boolean };
    group?: { visible?: boolean };
  },
  tileSize: number,
): void {
  const visibleSpan = getGeometryVisibleSpan(instance);
  const materials = instance.material === undefined
    ? (instance.materials ?? [])
    : [instance.material, ...(instance.materials ?? [])];
  const visibleOpacity = materials.length === 0
    ? 1
    : Math.max(...materials.map((material) => material.opacity ?? 1));
  expect(visibleSpan).toBeGreaterThanOrEqual(tileSize * 0.5);
  expect(instance.mesh?.visible ?? instance.group?.visible ?? true).toBe(true);
  for (const material of materials) {
    expect(material.visible ?? true).toBe(true);
  }
  expect(visibleOpacity).toBeGreaterThan(0);
}

export function assertThreeAnimationDisposal(
  instance: {
    geometry?: { dispose?: () => void };
    geometries?: readonly { dispose?: () => void }[];
    material?: { dispose?: () => void; map?: { dispose?: () => void } | null };
    materials?: readonly { dispose?: () => void; map?: { dispose?: () => void } | null }[];
  },
  dispose: () => void,
): void {
  const geometries = instance.geometry === undefined
    ? (instance.geometries ?? [])
    : [instance.geometry, ...(instance.geometries ?? [])];
  const materials = instance.material === undefined
    ? (instance.materials ?? [])
    : [instance.material, ...(instance.materials ?? [])];
  const geometryDisposes = geometries
    .filter((geometry): geometry is { dispose: () => void } => geometry.dispose !== undefined)
    .map((geometry) => vi.spyOn(geometry, 'dispose'));
  const materialDisposes = materials
    .filter((material): material is { dispose: () => void; map?: { dispose?: () => void } | null } => material.dispose !== undefined)
    .map((material) => vi.spyOn(material, 'dispose'));
  const textureDisposes = materials
    .filter((material): material is { map: { dispose: () => void } } => material.map?.dispose !== undefined)
    .map((material) => vi.spyOn(material.map, 'dispose'));

  dispose();

  for (const geometryDispose of geometryDisposes) {
    expect(geometryDispose).toHaveBeenCalled();
  }
  for (const materialDispose of materialDisposes) {
    expect(materialDispose).toHaveBeenCalled();
  }
  for (const textureDispose of textureDisposes) {
    expect(textureDispose).toHaveBeenCalled();
  }
}

/**
 * Run the standard lifecycle contract for a ThreeAnimationModule.
 *
 * Call inside a describe() block. The helper registers its own it() cases.
 *
 * @param module The ThreeAnimationModule to test
 * @param tileSize Optional tile size override (default 24)
 */
export function runThreeAnimationContract<TInstance>(
  module: ThreeAnimationModule<TInstance>,
  tileSize = 24,
): void {
  let handle: MockRendererHandle;
  let ctx: ReturnType<typeof makeMockContext>;

  beforeEach(() => {
    handle = makeMockThreeRenderer();
    ctx = makeMockContext(handle, { tileSize });
  });

  it('has a valid AnimationId (fx.<category>.<name>)', () => {
    expect(module.id).toMatch(/^fx\.[a-z]+\.[a-z0-9-]+$/);
  });

  it('has a category matching the id prefix', () => {
    const categoryFromId = module.id.split('.')[1];
    expect(module.category).toBe(categoryFromId);
  });

  it('create() does not throw', () => {
    expect(() => module.create(ctx)).not.toThrow();
  });

  it('create() calls scene.add', () => {
    module.create(ctx);
    expect(handle.scene.add).toHaveBeenCalledTimes(1);
  });

  it('setPosition() does not throw with center-viewport position', () => {
    const instance = module.create(ctx);
    expect(() =>
      module.setPosition(instance, { x: 240, y: 180, z: 0 }),
    ).not.toThrow();
  });

  it('setPosition() does not throw at canvas origin (0, 0)', () => {
    const instance = module.create(ctx);
    expect(() =>
      module.setPosition(instance, { x: 0, y: 0, z: 0 }),
    ).not.toThrow();
  });

  it('update() does not throw at progress 0', () => {
    const instance = module.create(ctx);
    expect(() => module.update(instance, 0)).not.toThrow();
  });

  it('update() does not throw at progress 0.5', () => {
    const instance = module.create(ctx);
    expect(() => module.update(instance, 0.5)).not.toThrow();
  });

  it('update() does not throw at progress 1', () => {
    const instance = module.create(ctx);
    expect(() => module.update(instance, 1)).not.toThrow();
  });

  it('dispose() does not throw', () => {
    const instance = module.create(ctx);
    expect(() => module.dispose(instance)).not.toThrow();
  });

  it('dispose() calls scene.remove', () => {
    const instance = module.create(ctx);
    module.dispose(instance);
    expect(handle.scene.remove).toHaveBeenCalledTimes(1);
  });

  it('creates a visible tile-scale instance at progress 0.5', () => {
    const instance = module.create(ctx) as {
      geometry?: { parameters?: Record<string, unknown> };
      geometries?: readonly { parameters?: Record<string, unknown> }[];
      material?: { opacity?: number; visible?: boolean };
      materials?: readonly { opacity?: number; visible?: boolean }[];
      mesh?: { visible?: boolean };
      group?: { visible?: boolean };
    };
    module.setPosition(instance as TInstance, { x: 120, y: 96, z: 0 });
    module.update(instance as TInstance, 0.5);
    assertThreeAnimationVisibility(instance, tileSize);
  });

  it('dispose() releases geometry/material/texture resources', () => {
    const instance = module.create(ctx) as {
      geometry?: { dispose?: () => void };
      geometries?: readonly { dispose?: () => void }[];
      material?: { dispose?: () => void; map?: { dispose?: () => void } | null };
      materials?: readonly { dispose?: () => void; map?: { dispose?: () => void } | null }[];
    };
    assertThreeAnimationDisposal(instance, () => module.dispose(instance as TInstance));
  });

  it('full lifecycle create → setPosition → update → dispose runs without error', () => {
    const instance = module.create(ctx);
    module.setPosition(instance, { x: 120, y: 96, z: 0 });
    module.update(instance, 0);
    module.update(instance, 0.5);
    module.update(instance, 1);
    module.dispose(instance);

    expect(handle.scene.add).toHaveBeenCalledTimes(1);
    expect(handle.scene.remove).toHaveBeenCalledTimes(1);
  });
}
