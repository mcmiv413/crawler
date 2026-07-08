/**
 * Test layer: unit
 * Behavior: run Three Animation Contract covers runThreeAnimationContract guardrails; fails sub-pixel geometry that would be invisible at runtime; fails modules that do not dispose geom....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/rendering/three/testing/run-three-animation-contract.test.ts
 */
import { describe, expect, it, vi } from 'vitest';
import {
  assertThreeAnimationDisposal,
  assertThreeAnimationVisibility,
} from './run-three-animation-contract.js';

describe('runThreeAnimationContract guardrails', () => {
  it('fails sub-pixel geometry that would be invisible at runtime', () => {
    expect(() => assertThreeAnimationVisibility({
      geometry: { parameters: { width: 0.4, height: 0.4 } },
      material: { opacity: 1, visible: true },
      mesh: { visible: true },
    }, 24)).toThrow();
  });

  it('fails modules that do not dispose geometry or material resources', () => {
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn(), map: null };

    expect(() => assertThreeAnimationDisposal(
      { geometry, material },
      () => {},
    )).toThrow();
  });
});
