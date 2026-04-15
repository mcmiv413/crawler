import type { AbilityContext, AbilityRequirement } from '../types.js';
import { getEquippedWeaponType } from '../../engine/handlers/combat.js';

/**
 * Validate that all requirements are met.
 */
export function validateRequirements(
  context: AbilityContext,
  requirements: readonly AbilityRequirement[],
): { valid: boolean; reason?: string } {
  for (const req of requirements) {
    const result = validateSingleRequirement(context, req);
    if (result.valid === false) {
      return result;
    }
  }
  return { valid: true };
}

function validateSingleRequirement(
  context: AbilityContext,
  req: AbilityRequirement,
): { valid: boolean; reason?: string } {
  switch (req.kind) {
    case 'weapon_type': {
      const equipped = getEquippedWeaponType(context.state);
      if (equipped !== req.weaponType) {
        return { valid: false, reason: `Requires ${req.weaponType} equipped` };
      }
      return { valid: true };
    }
    case 'has_target': {
      if (context.target === undefined) {
        return { valid: false, reason: 'Requires a target' };
      }
      return { valid: true };
    }
    case 'no_target': {
      if (context.target !== undefined) {
        return { valid: false, reason: 'Does not target enemies' };
      }
      return { valid: true };
    }
    case 'player_missing_hp': {
      if (context.player.stats.health >= context.player.stats.maxHealth) {
        return { valid: false, reason: 'Already at full health' };
      }
      return { valid: true };
    }
    case 'target_in_melee_range': {
      if (context.target === undefined) {
        return { valid: false, reason: 'No target selected' };
      }
      // Melee range = adjacent tiles (distance <= 1, using Chebyshev distance)
      const dist = Math.max(
        Math.abs(context.player.position.x - context.target.instance.position.x),
        Math.abs(context.player.position.y - context.target.instance.position.y),
      );
      if (dist > 1) {
        return { valid: false, reason: 'Target out of melee range' };
      }
      return { valid: true };
    }
    case 'target_visible': {
      if (context.target === undefined) {
        return { valid: false, reason: 'No target selected' };
      }
      // For now, all selected targets are assumed visible (visibility is enforced at UI level)
      return { valid: true };
    }
    case 'target_below_hp_pct': {
      if (context.target === undefined) {
        return { valid: false, reason: 'No target selected' };
      }
      const target = context.target.instance;
      const hpPct = target.stats.health / target.stats.maxHealth;
      if (hpPct >= req.percentage) {
        return { valid: false, reason: `Target HP too high (need < ${Math.round(req.percentage * 100)}%)` };
      }
      return { valid: true };
    }
    default:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new Error(`Unknown requirement kind: ${(req as any).kind}`);

  }
}
