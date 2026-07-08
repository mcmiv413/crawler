/**
 * Test layer: unit
 * Behavior: The Three animation contract guardrails reject invisible sub-pixel geometry and modules that fail to dispose resources.
 * Proof: Assertions expect assertThreeAnimationVisibility to throw for 0.4-by-0.4 geometry and assertThreeAnimationDisposal to throw when geometry/material dispose spies are never called.
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
