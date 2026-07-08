/**
 * Test layer: unit
 * Behavior: Projectile animation modules satisfy the shared lifecycle contract and keep singleArrow, emberBolt, and arrowVolley traveling from source to target over progress.
 * Proof: runThreeAnimationContract assertions check ID/category, create/setPosition/update/dispose, scene.add/remove, visibility, and resource disposal; direct assertions check group.position start/intermediate/end coordinates, path rotation, and emberBolt impact scale growth.
 * Validation: pnpm vitest run apps/web/src/rendering/three/modules/projectile/projectile-modules.test.ts
 */
/**
 * Lifecycle contract tests for all projectile Three animation modules.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { makeMockContext, makeMockThreeRenderer } from '../../testing/mock-three-renderer.js';
import { singleArrow } from './single-arrow.js';
import { arrowVolley } from './arrow-volley.js';
import { emberBolt } from './ember-bolt.js';
import { lightningBolt } from './lightning-bolt.js';

describe('singleArrow', () => { runThreeAnimationContract(singleArrow); });
describe('arrowVolley', () => { runThreeAnimationContract(arrowVolley); });
describe('emberBolt', () => { runThreeAnimationContract(emberBolt); });
describe('lightningBolt', () => { runThreeAnimationContract(lightningBolt); });

describe('projectile travel fidelity', () => {
  const handle = makeMockThreeRenderer();
  const ctx = makeMockContext(handle, { tileSize: 24 });

  beforeEach(() => {
    handle.scene.add.mockClear();
    handle.scene.remove.mockClear();
  });

  it('singleArrow interpolates from source to target via group.position and rotates along the travel path', () => {
    const instance = singleArrow.create(ctx) as any;
    singleArrow.setPosition(instance, {
      x: 240,
      y: 180,
      z: 0,
      source: { x: 120, y: 180 },
      target: { x: 240, y: 240 },
    });

    singleArrow.update(instance, 0);
    expect(instance.group.position.x).toBeCloseTo(120);
    expect(instance.group.position.y).toBeCloseTo(180);

    singleArrow.update(instance, 0.41);
    expect(instance.group.position.x).toBeGreaterThan(120);
    expect(instance.group.position.x).toBeLessThan(240);
    expect(instance.group.rotation.z).not.toBe(0);

    singleArrow.update(instance, 1);
    expect(instance.group.position.x).toBeCloseTo(240);
    expect(instance.group.position.y).toBeCloseTo(240);
  });

  it('emberBolt travels to the target via group.position before the impact burst', () => {
    const instance = emberBolt.create(ctx) as any;
    emberBolt.setPosition(instance, {
      x: 240,
      y: 180,
      z: 0,
      source: { x: 96, y: 180 },
      target: { x: 240, y: 180 },
    });

    emberBolt.update(instance, 0);
    expect(instance.group.position.x).toBeCloseTo(96);

    emberBolt.update(instance, 0.4);
    expect(instance.group.position.x).toBeGreaterThan(96);
    expect(instance.group.position.x).toBeLessThan(240);

    emberBolt.update(instance, 0.8);
    expect(instance.group.position.x).toBeCloseTo(240);
    expect(instance.coreMesh.scale.x).toBeCloseTo(1);

    emberBolt.update(instance, 1);
    expect(instance.group.position.x).toBeCloseTo(240);
    expect(instance.coreMesh.scale.x).toBeGreaterThan(1);
  });

  it('arrowVolley moves its group from source to target over progress', () => {
    const instance = arrowVolley.create(ctx) as any;
    arrowVolley.setPosition(instance, {
      x: 240,
      y: 180,
      z: 0,
      source: { x: 96, y: 180 },
      target: { x: 240, y: 252 },
    });

    arrowVolley.update(instance, 0);
    expect(instance.group.position.x).toBeCloseTo(96);
    expect(instance.group.position.y).toBeCloseTo(180);

    arrowVolley.update(instance, 0.4);
    expect(instance.group.position.x).toBeGreaterThan(96);
    expect(instance.group.position.x).toBeLessThan(240);
    expect(instance.group.position.y).toBeGreaterThan(180);
    expect(instance.group.position.y).toBeLessThan(252);
    expect(instance.group.rotation.z).not.toBe(0);

    arrowVolley.update(instance, 1);
    expect(instance.group.position.x).toBeCloseTo(240);
    expect(instance.group.position.y).toBeCloseTo(252);
  });
});
