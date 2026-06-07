import type { DomainEvent, EnemyInstance } from '@dungeon/contracts';
import type { AbilityContext, AttackEffect } from '../types.js';
import { applyStatusToEnemy, getEffectiveStat } from '../../systems/status-effects.js';
import { resolveAttack } from '../../systems/combat.js';
import { checkWeaponMasteryUnlocks } from '../../systems/weapon-mastery.js';
import { getEquippedWeaponType, getEquippedWeaponDamageType } from '../../engine/handlers/combat.js';
import { processEnemyKill } from '../../engine/enemy-death-pipeline.js';
import { updateRunMetrics } from '../../engine/handlers/shared.js';
import { MAGIC, STATUS_DEFAULTS, arcaneCharge, burn, heatSurgeStatus } from '@dungeon/content';
import { getFireBurnDuration, getFireBurnMagnitude } from '../../systems/magic-xp.js';

function arcaneChargeBonus(statuses: AbilityContext['player']['statuses']): number {
  const charge = statuses.find(status => status.id === arcaneCharge.id);
  return charge?.magnitude ?? 0;
}

function applyHeatSurgeBurn(
  enemy: EnemyInstance,
  context: AbilityContext,
): { enemy: EnemyInstance; events: DomainEvent[] } {
  const hasHeatSurge = context.state.player.statuses.some(status => status.id === heatSurgeStatus.id);
  if (hasHeatSurge === false) return { enemy, events: [] };

  const defaults = STATUS_DEFAULTS.burn;
  const duration = getFireBurnDuration(context.player, defaults.defaultDuration);
  const magnitude = getFireBurnMagnitude(context.player);
  const updatedEnemy = applyStatusToEnemy(enemy, burn.id, duration, magnitude, context.player.id);
  return {
    enemy: updatedEnemy,
    events: [{
      type: 'STATUS_APPLIED',
      targetId: enemy.id,
      statusId: burn.id,
      duration,
      sourceId: context.player.id,
      timestamp: context.state.turnNumber,
      turnNumber: context.state.turnNumber,
    }],
  };
}

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
    // No active run — cannot resolve attack. Emit a visible invalid-target event so the
    // player can see why no damage was applied rather than getting a silent no-op.
    const invalidTargetEvent: DomainEvent = {
      type: 'ATTACK_PERFORMED',
      attackerId: context.player.id,
      defenderId: context.target?.instance.id ?? context.player.id,
      attackerName: context.player.name,
      defenderName: context.target?.instance.name ?? 'unknown',
      damage: 0,
      damageType: effect.damageType ?? 'physical',
      hit: false,
      critical: false,
      position: context.target?.instance.position ?? context.player.position,
      reason: 'invalid_target',
      timestamp: newState.turnNumber,
      turnNumber: newState.turnNumber,
    };
    return { state: newState, events: [invalidTargetEvent], hit: false, damage: 0 };
  }

  // Look up the target from the current state using the targetKey
  const target = newState.run.enemies.get(targetKey);
  if (target === undefined) {
    // Target not found in enemy map — may have died or been removed since the ability was cast.
    // Emit a visible invalid-target event so the player can see why no damage was applied.
    const invalidTargetEvent: DomainEvent = {
      type: 'ATTACK_PERFORMED',
      attackerId: context.player.id,
      defenderId: context.target?.instance.id ?? context.player.id,
      attackerName: context.player.name,
      defenderName: context.target?.instance.name ?? 'unknown',
      damage: 0,
      damageType: effect.damageType ?? 'physical',
      hit: false,
      critical: false,
      position: context.target?.instance.position ?? context.player.position,
      reason: 'invalid_target',
      timestamp: newState.turnNumber,
      turnNumber: newState.turnNumber,
    };
    return { state: newState, events: [invalidTargetEvent], hit: false, damage: 0 };
  }

  const defenderDefense = getEffectiveStat(target.stats.defense, 'defense', target.statuses);
  const abilityWeaponDamageType = effect.damageType ?? getEquippedWeaponDamageType(newState);
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

  const spellBonus = effect.spell === true ? Math.min(MAGIC.arcaneChargeMaxStacks, arcaneChargeBonus(newState.player.statuses)) : 0;
  const effectiveAttack = getEffectiveStat(newState.player.stats.attack, 'attack', newState.player.statuses) * damageMultiplier + (effect.flatBonus ?? 0) + spellBonus;
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
      const heatSurgeResult = applyHeatSurgeBurn(
        { ...target, stats: { ...target.stats, health: newHealth } },
        context,
      );
      generatedEvents = [...generatedEvents, ...heatSurgeResult.events];
      newEnemies.set(targetKey, heatSurgeResult.enemy);
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
