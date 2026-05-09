/**
 * AOE animations — blast radius effects, explosions, area-of-effect bursts.
 * Key: suppressActorBump must be explicitly declared.
 */

import type { AnimationRef } from './types.js';

export const bombBlast = {
  id: 'fx.aoe.bomb-blast',
  category: 'aoe',
  durationMs: 800,
  suppressActorBump: false,
} as const satisfies AnimationRef;
