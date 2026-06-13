export { buildGameView } from './game-view-builder.js';
export { buildDeterministicRunSummary, buildDeterministicTownRumors } from './builders/town-text.js';
export { formatEvent, formatEvents } from './event-formatter.js';
export { buildCombatIndicators } from './combat-indicators.js';
export { buildBumpAnimations } from './bump-animations.js';
export { buildAnimationSequence, getAnimatedEventBatchSettleMs, getBumpTiming } from './animation-sequence.js';
export {
  ANIMATION_TIMING,
  BUMP_ANIMATION_DURATION_MS,
  BUMP_IMPACT_FRACTION,
  CONSUMABLE_ANIMATION_METADATA,
  MOVE_ANIMATION_DURATIONS,
  PLAYER_STATUS_PRESENTATION,
  getBeatSettleMs,
} from './animation-metadata.js';

export type { AnimatedEvent, DefenderHitEntry } from './animation-sequence.js';
export type { ConsumableAnimationEffect } from './animation-metadata.js';
export type * from './game-view.js';
