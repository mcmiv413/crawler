/**
 * Tests for three-combat-label.ts
 *
 * Creates disposable text textures for floating combat indicator labels.
 * Contracts:
 *  - Label texture is created with readable text
 *  - Canvas size accommodates text without truncation
 *  - Opacity starts at 1 and fades correctly
 *  - Multiple labels can coexist (independent instances)
 *  - Disposal releases texture memory
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createCombatLabel,
  setCombatLabelOpacity,
  setCombatLabelPosition,
  disposeCombatLabel,
} from './three-combat-label.js';

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

function makeScene() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
  };
}

function makeContext(canvasHeight = 360) {
  return {
    renderer: {},
    scene: makeScene(),
    camera: {},
    canvasWidth: 480,
    canvasHeight,
    vpLeft: 0,
    vpTop: 0,
    tileSize: 24,
  };
}

// ---------------------------------------------------------------------------
// Suite: createCombatLabel
// ---------------------------------------------------------------------------

describe('createCombatLabel', () => {
  it('returns a label instance', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+15');
    expect(label).toBeDefined();
  });

  it('adds the label mesh to the scene', () => {
    const ctx = makeContext();
    createCombatLabel(ctx, '+15');
    expect(ctx.scene.add).toHaveBeenCalledTimes(1);
  });

  it('label has a material with a map (texture)', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+15');
    expect(label.material).toBeDefined();
    expect(label.material.map).toBeDefined();
  });

  it('initial opacity is 1', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+15');
    expect(label.material.opacity).toBeCloseTo(1);
  });

  it('creates independent instances for different texts', () => {
    const ctx = makeContext();
    const labelA = createCombatLabel(ctx, '+15');
    const labelB = createCombatLabel(ctx, '-8');
    expect(labelA).not.toBe(labelB);
    expect(labelA.material).not.toBe(labelB.material);
  });

  it('creates independent instances with the same text', () => {
    const ctx = makeContext();
    const labelA = createCombatLabel(ctx, '+5');
    const labelB = createCombatLabel(ctx, '+5');
    expect(labelA).not.toBe(labelB);
  });

  it('handles empty string text without throwing', () => {
    const ctx = makeContext();
    expect(() => createCombatLabel(ctx, '')).not.toThrow();
  });

  it('handles unicode text including emoji', () => {
    const ctx = makeContext();
    expect(() => createCombatLabel(ctx, '💀')).not.toThrow();
  });

  it('handles long text without throwing', () => {
    const ctx = makeContext();
    expect(() => createCombatLabel(ctx, 'CRITICAL HIT +999')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite: setCombatLabelOpacity
// ---------------------------------------------------------------------------

describe('setCombatLabelOpacity', () => {
  it('sets material opacity to the given value', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    setCombatLabelOpacity(label, 0.5);
    expect(label.material.opacity).toBeCloseTo(0.5);
  });

  it('sets opacity to 0 (fully transparent)', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    setCombatLabelOpacity(label, 0);
    expect(label.material.opacity).toBeCloseTo(0);
  });

  it('sets opacity to 1 (fully opaque)', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    setCombatLabelOpacity(label, 0.2);
    setCombatLabelOpacity(label, 1);
    expect(label.material.opacity).toBeCloseTo(1);
  });

  it('material.transparent is true so opacity can be < 1', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    expect(label.material.transparent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite: setCombatLabelPosition
// ---------------------------------------------------------------------------

describe('setCombatLabelPosition', () => {
  it('positions the label mesh without throwing', () => {
    const ctx = makeContext(360);
    const label = createCombatLabel(ctx, '+10');
    expect(() =>
      setCombatLabelPosition(label, { x: 100, y: 200, z: 1 }, ctx.canvasHeight),
    ).not.toThrow();
  });

  it('applies y-axis flip: mesh.position.y = canvasHeight - screenY', () => {
    const canvasHeight = 360;
    const ctx = makeContext(canvasHeight);
    const label = createCombatLabel(ctx, '+10');
    const screenY = 150;
    setCombatLabelPosition(label, { x: 80, y: screenY, z: 1 }, canvasHeight);
    expect(label.mesh.position.y).toBeCloseTo(canvasHeight - screenY);
  });

  it('passes x through unchanged', () => {
    const ctx = makeContext(360);
    const label = createCombatLabel(ctx, '+10');
    setCombatLabelPosition(label, { x: 72, y: 100, z: 0 }, ctx.canvasHeight);
    expect(label.mesh.position.x).toBeCloseTo(72);
  });
});

// ---------------------------------------------------------------------------
// Suite: disposeCombatLabel
// ---------------------------------------------------------------------------

describe('disposeCombatLabel', () => {
  it('removes the mesh from scene', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    disposeCombatLabel(label, ctx.scene);
    expect(ctx.scene.remove).toHaveBeenCalledWith(label.mesh);
  });

  it('disposes the geometry', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    const geometryDispose = vi.spyOn(label.geometry, 'dispose');
    disposeCombatLabel(label, ctx.scene);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
  });

  it('disposes the material', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    const materialDispose = vi.spyOn(label.material, 'dispose');
    disposeCombatLabel(label, ctx.scene);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it('disposes the texture (map)', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    const textureDispose = vi.spyOn(label.material.map!, 'dispose');
    disposeCombatLabel(label, ctx.scene);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });

  it('does not throw on dispose when called once', () => {
    const ctx = makeContext();
    const label = createCombatLabel(ctx, '+5');
    expect(() => disposeCombatLabel(label, ctx.scene)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite: stacking — multiple labels are independent
// ---------------------------------------------------------------------------

describe('label stacking', () => {
  it('four labels can coexist with independent opacity', () => {
    const ctx = makeContext();
    const labelA = createCombatLabel(ctx, '+5');
    const labelB = createCombatLabel(ctx, '+10');
    const labelC = createCombatLabel(ctx, '-3');
    const labelD = createCombatLabel(ctx, 'MISS');

    setCombatLabelOpacity(labelA, 0.9);
    setCombatLabelOpacity(labelB, 0.6);
    setCombatLabelOpacity(labelC, 0.3);
    setCombatLabelOpacity(labelD, 0.1);

    expect(labelA.material.opacity).toBeCloseTo(0.9);
    expect(labelB.material.opacity).toBeCloseTo(0.6);
    expect(labelC.material.opacity).toBeCloseTo(0.3);
    expect(labelD.material.opacity).toBeCloseTo(0.1);
  });
});
