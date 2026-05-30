import type { AnyItemTemplate, EnemyInstance, GameState, WeaponTemplate } from '@dungeon/contracts';
import { COMBAT, getDamageBand, getWeaponDamageProfile } from '@dungeon/content';
import { getEffectiveStat } from './systems/status-effects.js';
import { applyRangeAccuracyPenalty, calculateHitChance } from './utils/dice.js';
import { chebyshevDistance } from './utils/grid.js';

export type ThreatRating = 'Low' | 'Moderate' | 'High' | 'Deadly';

export interface PlayerOffensePreview {
  readonly attack: number;
  readonly totalDamageMin: number;
  readonly totalDamageMax: number;
}

export interface EnemyCombatPreview {
  readonly isFasterThanPlayer: boolean;
  readonly playerHitChance: number;
  readonly enemyHitChance: number;
  readonly threatRating: ThreatRating;
}

interface EnemyWeaponRuntimeShape {
  readonly weaponRange?: number;
  readonly minRange?: number;
}

function isWeaponTemplate(item: AnyItemTemplate | null | undefined): item is WeaponTemplate {
  return item?.itemClass === 'weapon' && 'weapon' in item;
}

function isEnemyWeaponRuntimeShape(value: unknown): value is EnemyWeaponRuntimeShape {
  return typeof value === 'object' && value !== null;
}

function getEnemyWeaponRange(enemy: EnemyInstance): { weaponRange: number; minRange: number } {
  const maybeEquipment: unknown = Reflect.get(enemy, 'equipment');
  if (typeof maybeEquipment !== 'object' || maybeEquipment === null) {
    return { weaponRange: 1, minRange: 0 };
  }

  const maybeWeapon: unknown = Reflect.get(maybeEquipment, 'weapon');
  if (!isEnemyWeaponRuntimeShape(maybeWeapon)) {
    return { weaponRange: 1, minRange: 0 };
  }

  return {
    weaponRange: typeof maybeWeapon.weaponRange === 'number' ? maybeWeapon.weaponRange : 1,
    minRange: typeof maybeWeapon.minRange === 'number' ? maybeWeapon.minRange : 0,
  };
}

export function getPlayerOffensePreview(state: GameState): PlayerOffensePreview {
  const attack = getEffectiveStat(state.player.stats.attack, 'attack', state.player.statuses);
  const weapon = state.player.equipment.weapon === null
    ? null
    : state.itemRegistry.items.get(state.player.equipment.weapon);
  if (!isWeaponTemplate(weapon)) {
    return {
      attack,
      totalDamageMin: attack,
      totalDamageMax: attack,
    };
  }

  const damageBand = getDamageBand(
    weapon.weapon.damage,
    getWeaponDamageProfile(weapon.weapon.weaponType, weapon.weapon.weaponRange),
  );

  return {
    attack,
    totalDamageMin: damageBand.min + attack,
    totalDamageMax: damageBand.max + attack,
  };
}

export function getEnemyCombatPreview(
  state: GameState,
  enemy: EnemyInstance,
): EnemyCombatPreview {
  const distance = chebyshevDistance(state.player.position, enemy.position);

  return {
    isFasterThanPlayer: enemy.stats.speed > state.player.stats.speed,
    playerHitChance: getPlayerHitChanceAgainstEnemy(state, enemy, distance),
    enemyHitChance: getEnemyHitChanceAgainstPlayer(state, enemy, distance),
    threatRating: computeThreatRating(enemy, state),
  };
}

function getPlayerHitChanceAgainstEnemy(
  state: GameState,
  enemy: EnemyInstance,
  distance: number,
): number {
  let playerAccuracy = getEffectiveStat(state.player.stats.accuracy, 'accuracy', state.player.statuses);
  const { weaponRange, minRange } = getPlayerWeaponRange(state);

  if (weaponRange > 1 || minRange > 0) {
    playerAccuracy = applyRangeAccuracyPenalty(
      playerAccuracy,
      distance,
      minRange,
      COMBAT.rangedAccuracyDropPerTile,
    );
  }

  return calculateHitChance(
    COMBAT.baseHitChance,
    playerAccuracy,
    enemy.stats.evasion,
    COMBAT.minHitChance,
    COMBAT.maxHitChance,
  );
}

function getEnemyHitChanceAgainstPlayer(
  state: GameState,
  enemy: EnemyInstance,
  distance: number,
): number {
  let enemyAccuracy = enemy.stats.accuracy;
  const { weaponRange: enemyWeaponRange, minRange: enemyMinRange } = getEnemyWeaponRange(enemy);

  if (enemyWeaponRange > 1 || enemyMinRange > 0) {
    enemyAccuracy = applyRangeAccuracyPenalty(
      enemyAccuracy,
      distance,
      enemyMinRange,
      COMBAT.rangedAccuracyDropPerTile,
    );
  }

  return calculateHitChance(
    COMBAT.baseHitChance,
    enemyAccuracy,
    state.player.stats.evasion,
    COMBAT.minHitChance,
    COMBAT.maxHitChance,
  );
}

function getPlayerWeaponRange(state: GameState): { weaponRange: number; minRange: number } {
  if (state.player.equipment.weapon === null) {
    return { weaponRange: 1, minRange: 0 };
  }

  const item = state.itemRegistry.items.get(state.player.equipment.weapon);
  if (!isWeaponTemplate(item)) {
    return { weaponRange: 1, minRange: 0 };
  }

  return {
    weaponRange: item.weapon.weaponRange,
    minRange: item.weapon.minRange ?? 0,
  };
}

function computeThreatRating(enemy: EnemyInstance, state: GameState): ThreatRating {
  const playerStats = state.player.stats;
  const enemyStats = enemy.stats;

  const enemyMidBand = Math.round(enemyStats.attack);
  const playerMidBand = Math.round(playerStats.attack);
  const hitsToKillPlayer = Math.ceil(playerStats.health / Math.max(1, enemyMidBand));
  const hitsToKillEnemy = Math.ceil(enemyStats.health / Math.max(1, playerMidBand));
  const enemyRange = getEnemyWeaponRange(enemy).weaponRange;
  const playerRange = getPlayerWeaponRange(state).weaponRange;
  const enemyFaster = enemyStats.speed > playerStats.speed;

  if (hitsToKillPlayer <= 2) {
    return 'Deadly';
  }
  if (enemyFaster && enemyRange > playerRange) {
    return 'Deadly';
  }
  if (hitsToKillPlayer === 3) {
    return 'High';
  }
  if (enemyFaster && enemyRange > 1) {
    return 'High';
  }
  if (hitsToKillEnemy >= 5) {
    return 'High';
  }
  if (hitsToKillPlayer >= 4 && hitsToKillPlayer <= 5) {
    return 'Moderate';
  }
  if (enemyRange > playerRange) {
    return 'Moderate';
  }
  if (enemyFaster === true) {
    return 'Moderate';
  }

  return 'Low';
}
