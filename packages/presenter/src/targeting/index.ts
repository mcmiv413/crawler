/**
 * Shared targeting rules consumed by both presenter and web layers.
 * Pure functions for determining valid targets and action enablement.
 */

export {
  getEffectiveRange,
  getValidEnemyTargets,
  getAutoTargetOrShowChooser,
  isTargetingActionEnabled,
  getValidDisarmableTraps,
  getValidTrapPlacementDirections,
} from './targeting-rules.js';
