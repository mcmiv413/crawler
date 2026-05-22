import { describe, expect, it } from 'vitest';
import { ANIMATION_REF_BY_ID, animationRefs } from './index.js';

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
});
