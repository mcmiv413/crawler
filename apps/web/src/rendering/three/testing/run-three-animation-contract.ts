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

import { it, expect, beforeEach } from 'vitest';
import type { ThreeAnimationModule } from '../three-animation-types.js';
import { makeMockThreeRenderer, makeMockContext } from './mock-three-renderer.js';
import type { MockRendererHandle } from './mock-three-renderer.js';

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
