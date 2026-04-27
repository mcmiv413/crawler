import type { DomainEvent } from '@dungeon/contracts';
import type { AbilityContext, AttackEffect } from '../types.js';
import { getEffectiveStat } from '../../systems/status-effects.js';
import { resolveAttack } from '../../systems/combat.js';
import { checkWeaponMasteryUnlocks } from '../../systems/weapon-mastery.js';
import { processEnemyKill, getEquippedWeaponType, getEquippedWeaponDamageType } from '../../engine/handlers/combat.js';
import { updateRunMetrics } from '../../engine/handlers/shared.js';

/**
 * Apply an attack effect to a target.
 * Extracted from resolveAbilityAttack in ability-dispatch.ts.
 */
export function applyAttack(
  context: AbilityContext,
  effect: AttackEffect,
  targetKey: string,
): { state: typeof context.state; events: readonly DomainEvent[]; hit: boolean; damage: number } {
  let newState = context.state;
  let generatedEvents: DomainEvent[] = [];

  if (newState.run === null) {
    return { state: newState, events: [], hit: false, damage: 0 };
  }

  // Look up the target from the current state using the targetKey
  const target = newState.run.enemies.get(targetKey);
  if (target === undefined) {
    return { state: newState, events: [], hit: false, damage: 0 };
  }

  const defenderDefense = getEffectiveStat(target.stats.defense, 'defense', target.statuses);
  const abilityWeaponDamageType = getEquippedWeaponDamageType(newState);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const affinityValue = target.affinities?.[abilityWeaponDamageType];
  const abilityDefenderResistance = affinityValue ?? 0;

  // Determine damage multiplier: check if this is adjacent to primary target (50% damage for adjacent)
  let damageMultiplier = effect.damageMultiplier;
  if (context.target !== undefined && context.target.key !== targetKey) {
    // This is an adjacent target in AOE; reduce damage to 50%
    const primaryX = context.target.instance.position.x;
    const primaryY = context.target.instance.position.y;
    const tx = target.position.x;
    const ty = target.position.y;
    const dx = Math.abs(tx - primaryX);
    const dy = Math.abs(ty - primaryY);
    if (dx <= 1 && dy <= 1) {
      // Adjacent to primary target
      damageMultiplier = 0.5;
    }
  }

  const effectiveAttack = getEffectiveStat(newState.player.stats.attack, 'attack', newState.player.statuses) * damageMultiplier + (effect.flatBonus ?? 0);
  const accuracyBonus = effect.accuracyBonus ?? 0;
  const forceHit = effect.forceHit === true;
  const trackMastery = effect.trackMastery === true;

  const result = resolveAttack({
    attackerId: newState.player.id,
    defenderId: target.id,
    attackerAttack: effectiveAttack,
    attackerAccuracy: newState.player.stats.accuracy + accuracyBonus,
    defenderDefense,
    defenderEvasion: forceHit === true ? 0 : target.stats.evasion,
    defenderHealth: target.stats.health,
    damageType: abilityWeaponDamageType,
    defenderResistance: abilityDefenderResistance,
  }, context.rng);

  let damage = 0;

  if (result.hit === true) {
    damage = result.damage;
    newState = updateRunMetrics(newState, { damageDealt: damage });
    const newHealth = Math.max(0, target.stats.health - damage);

    if (newHealth <= 0) {
      const killResult = processEnemyKill(newState, target, targetKey, context.rng);
      newState = killResult.state;
      generatedEvents = [...generatedEvents, ...killResult.events];
    } else if (newState.run !== null) {
      const currentRun = newState.run;
      const newEnemies = new Map(currentRun.enemies);
      newEnemies.set(targetKey, { ...target, stats: { ...target.stats, health: newHealth } });
      newState = { ...newState, run: { ...currentRun, enemies: newEnemies } };
    }

    if (trackMastery === true) {
      const wType = getEquippedWeaponType(newState);
      if (wType !== null) {
        const count = newState.weaponMastery[wType];
        newState = { ...newState, weaponMastery: { ...newState.weaponMastery, [wType]: count + 1 } };
        const masteryResult = checkWeaponMasteryUnlocks(newState, wType);
        newState = masteryResult.state;
        generatedEvents = [...generatedEvents, ...masteryResult.events];
      }
    }
  }

  return { state: newState, hit: result.hit, damage, events: generatedEvents };
}
