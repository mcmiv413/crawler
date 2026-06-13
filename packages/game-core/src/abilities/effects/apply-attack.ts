import type { DomainEvent, EnemyInstance } from '@dungeon/contracts';
import type { AbilityContext, AttackEffect } from '../types.js';
import { getEffectiveStat } from '../../systems/status-effects.js';
import { resolveAttack } from '../../systems/combat.js';
import { checkWeaponMasteryUnlocks } from '../../systems/weapon-mastery.js';
import { getEquippedWeaponType, getEquippedWeaponDamageType } from '../../engine/handlers/combat.js';
import { processEnemyKill } from '../../engine/enemy-death-pipeline.js';
import { updateRunMetrics } from '../../engine/handlers/shared.js';
import { applyDamageToEnemy } from '../../systems/damage.js';
import { MAGIC, arcaneCharge, burn, heatSurgeStatus } from '@dungeon/content';
import { applyPlayerStatusToEnemy } from '../../systems/status-application.js';

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

  const surgeBurn = applyPlayerStatusToEnemy(enemy, burn.id, context.player, context.state.turnNumber);
  return {
    enemy: surgeBurn.enemy,
    events: [surgeBurn.event],
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
    defenderEvasion: target.stats.evasion,
    defenderHealth: target.stats.health,
    damageType: abilityWeaponDamageType,
    defenderResistance: abilityDefenderResistance,
    forceHit,
  }, context.rng);

  let damage = 0;

  if (result.hit === true) {
    const damageResult = applyDamageToEnemy(newState, target.id, {
      amount: result.damage,
      damageType: result.damageType,
      source: 'ability',
      bypassDefense: true,
      bypassResistance: true,
      isCritical: result.criticalHit,
    });
    damage = damageResult.finalDamage;
    newState = updateRunMetrics(damageResult.state, { damageDealt: damage });

    if (damageResult.killed === true) {
      const killResult = processEnemyKill(newState, damageResult.targetSnapshot?.enemy ?? target, targetKey, context.rng, {
        targetSnapshot: damageResult.targetSnapshot,
        causeType: 'ability',
        causeId: context.abilityId,
        killerId: context.player.id,
        killerName: context.player.name,
        sourceEventType: 'ABILITY_USED',
        turnNumber: context.state.turnNumber,
      });
      newState = killResult.state;
      generatedEvents = [...generatedEvents, ...killResult.events];
    } else if (newState.run !== null) {
      const currentRun = newState.run;
      const newEnemies = new Map(currentRun.enemies);
      const damagedTarget = currentRun.enemies.get(targetKey) ?? target;
      const heatSurgeResult = applyHeatSurgeBurn(
        damagedTarget,
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
