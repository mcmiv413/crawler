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
