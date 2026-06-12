import type {
  AttackResult, CombatContext, StatusId, BalanceConfig,
} from '@dungeon/contracts';
import { COMBAT, getDamageBand } from '@dungeon/content';
import type { RNG } from '@dungeon/contracts';
import { rollDamage, rollDamageBetween, calculateHitChance, applyDefense } from '../utils/dice.js';

/**
 * 9-step combat resolution (SRD §8):
 * 1. legality check (caller responsibility)
 * 2. LOS/range check (caller responsibility)
 * 3. hit/evasion resolution
 * 4. damage calculation
 * 5. mitigation/reduction
 * 6. status application
 * 7. on-hit effects
 * 8. death resolution
 * 9. event hooks (caller responsibility)
 */
export function resolveAttack(
  ctx: CombatContext,
  rng: RNG,
  onHitStatus?: StatusId,
  onHitChance?: number,
  config?: BalanceConfig,
): AttackResult {
  const combatConfig = config?.combat ?? COMBAT;

  // Step 3: Hit resolution
  const forceHit = ctx.forceHit === true;
  const hitChance = forceHit === true
    ? 100
    : calculateHitChance(
      combatConfig.baseHitChance,
      ctx.attackerAccuracy,
      ctx.defenderEvasion,
      combatConfig.minHitChance,
      combatConfig.maxHitChance,
    );
  const hitRoll = forceHit === true ? undefined : rng.next() * 100;
  const hit = forceHit === true || (hitRoll !== undefined && hitRoll < hitChance);

  if (hit !== true) {
    // Determine reason for miss: evasion or accuracy
    // If hitChance would be higher without evasion, then evasion is the reason
    const hitChanceWithoutEvasion = calculateHitChance(
      combatConfig.baseHitChance,
      ctx.attackerAccuracy,
      0,  // No evasion
      combatConfig.minHitChance,
      combatConfig.maxHitChance,
    );
    const missReason = hitChanceWithoutEvasion > hitChance ? 'evasion' : 'accuracy';

    return {
      attackerId: ctx.attackerId,
      defenderId: ctx.defenderId,
      hit: false,
      damage: 0,
      damageType: ctx.damageType,
      mitigated: 0,
      statusesApplied: [],
      defenderDied: false,
      criticalHit: false,
      missReason,
      hitRoll,
    };
  }

  // Step 4: Damage calculation
  const criticalHit = rng.chance(combatConfig.critChance);
  let baseDamage: number;

  // Use weapon damage profile if available (NEW), otherwise fall back to old system
  if (ctx.weaponDamageProfile !== undefined && ctx.weaponBaseDamage !== undefined) {
    // NEW: weapon-based damage range
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const band = getDamageBand(ctx.weaponBaseDamage, ctx.weaponDamageProfile as any);
    const totalMin = band.min + ctx.attackerAttack;
    const totalMax = band.max + ctx.attackerAttack;
    baseDamage = rollDamageBetween(totalMin, totalMax, rng);
  } else {
    // Backward compatibility: old 0.15 variance system
    baseDamage = rollDamage(ctx.attackerAttack, 0.15, rng);
  }

  if (criticalHit === true) {
    baseDamage = Math.round(baseDamage * combatConfig.critMultiplier);
  }

  // Step 5: Mitigation
  const effectiveDefense = Math.max(0, ctx.defenderDefense);
  const resistance = ctx.defenderResistance;
  let mitigatedDamage = applyDefense(baseDamage, effectiveDefense, combatConfig.defenseDivisor);
  const mitigated = baseDamage - mitigatedDamage;

  // Apply elemental resistance
  if (resistance > 0) {
    mitigatedDamage = Math.max(combatConfig.minDamage, Math.round(mitigatedDamage * (1 - resistance)));
  } else if (resistance < 0) {
    // Vulnerability: negative resistance amplifies damage
    mitigatedDamage = Math.round(mitigatedDamage * (1 + Math.abs(resistance)));
  }

  const finalDamage = Math.max(combatConfig.minDamage, mitigatedDamage);

  // Step 6: Status application
  const statusesApplied: StatusId[] = (onHitStatus !== undefined && onHitChance !== undefined && rng.chance(onHitChance))
    ? [onHitStatus]
    : [];

  // Step 8: Death resolution
  const defenderDied = ctx.defenderHealth - finalDamage <= 0;

  return {
    attackerId: ctx.attackerId,
    defenderId: ctx.defenderId,
    hit: true,
    damage: finalDamage,
    damageType: ctx.damageType,
    mitigated: mitigated + (baseDamage - mitigatedDamage - finalDamage),
    statusesApplied,
    defenderDied,
    criticalHit,
    ...(hitRoll !== undefined ? { hitRoll } : {}),
  };
}
