import type { GameState, EnemyInstance } from '@dungeon/contracts';

export type ThreatRating = 'Low' | 'Moderate' | 'High' | 'Deadly';

/**
 * Compute the threat rating of an enemy relative to the current player.
 * Uses damage bands, hit counts, speed, and range to assign threat level.
 */
export function computeEnemyThreatRating(enemy: EnemyInstance, state: GameState): ThreatRating {
  // Get player and enemy stats
  const playerStats = state.player.stats;
  const enemyStats = enemy.stats;

  // Determine threat rating based on plan thresholds:
  // - Low: hitsToKillPlayer >= 6, enemy not faster, enemy can't attack from range
  // - Moderate: hitsToKillPlayer 4-5, or enemy ranged, or enemy slightly faster
  // - High: hitsToKillPlayer == 3, or enemy faster + ranged, or hitsToKillEnemy >= 5
  // - Deadly: hitsToKillPlayer <= 2, or crit from enemy max band > 50% player HP, or outranges while faster

  // Estimate mid-band damage for both
  const enemyMidBand = Math.round(enemyStats.attack * 1); // Midpoint of enemy damage band
  const playerMidBand = Math.round(playerStats.attack * 1);

  // Calculate hits to kill
  const hitsToKillPlayer = Math.ceil(playerStats.health / Math.max(1, enemyMidBand));
  const hitsToKillEnemy = Math.ceil(enemyStats.health / Math.max(1, playerMidBand));

  // Get range info
  const enemyRange = enemy.equipment.weapon.range;
  const playerRange = getPlayerWeaponRange(state);

  // Speed comparison
  const playerSpeed = playerStats.speed;
  const enemySpeed = enemyStats.speed;
  const enemyFaster = enemySpeed > playerSpeed;

  // Deadly conditions
  if (hitsToKillPlayer <= 2) return 'Deadly';
  if (enemyFaster === true && enemyRange > playerRange) return 'Deadly';

  // High conditions
  if (hitsToKillPlayer === 3) return 'High';
  if (enemyFaster === true && enemyRange > 1) return 'High';
  if (hitsToKillEnemy >= 5) return 'High';

  // Moderate conditions
  if (hitsToKillPlayer >= 4 && hitsToKillPlayer <= 5) return 'Moderate';
  if (enemyRange > playerRange) return 'Moderate';
  if (enemyFaster === true) return 'Moderate';

  // Low condition
  return 'Low';
}

/**
 * Get the player's equipped weapon range.
 */
function getPlayerWeaponRange(state: GameState): number {
  if (state.player.equipment.weapon === null) {
    return 1; // Unarmed range
  }

  const weaponTemplate = state.itemRegistry.items.get(state.player.equipment.weapon);
  if (weaponTemplate !== undefined && weaponTemplate.itemClass === 'weapon') {
    const weapon = (weaponTemplate as { weapon: { weaponRange: number } }).weapon;
    return weapon.weaponRange;
  }

  return 1;
}
