/**
 * Test layer: unit
 * Behavior: The animation ref catalog exposes integer timing fields, declares actor-bump suppression on moving effect refs, and resolves status overlays to status refs.
 * Proof: Assertions expect integer impactFrameMs and recoveryMs, suppressActorBump keys on projectile and aoe refs, defined overlay refs, and status categories for overlays.
 * Validation: pnpm vitest run packages/content/src/animation-refs/index.test.ts
 */
import { describe, expect, it } from 'vitest';
import { ANIMATION_REF_BY_ID, animationRefs } from './index.js';
import { STATUS_DEFINITIONS } from '../statuses/index.js';

describe('animation ref catalog', () => {
  it('every exported ref has integer impact and recovery timing', () => {
    for (const ref of ANIMATION_REF_BY_ID.values()) {
      expect(Number.isInteger(ref.impactFrameMs), `${ref.id} impactFrameMs`).toBe(true);
      expect(Number.isInteger(ref.recoveryMs), `${ref.id} recoveryMs`).toBe(true);
    }
  });

  it('projectile and aoe refs explicitly declare suppressActorBump', () => {
    for (const ref of [...Object.values(animationRefs.projectile), ...Object.values(animationRefs.aoe)]) {
      expect('suppressActorBump' in ref, `${ref.id} suppressActorBump`).toBe(true);
    }
  });

  it('every status overlay id resolves to a registered status animation ref', () => {
    for (const status of STATUS_DEFINITIONS.values()) {
      if (status.overlay === undefined) {
        continue;
      }

      const ref = ANIMATION_REF_BY_ID.get(status.overlay.id);
      expect(ref, `${status.id} overlay animation ref`).toBeDefined();
      expect(ref?.category, `${status.id} overlay animation category`).toBe('status');
    }
  });
});
