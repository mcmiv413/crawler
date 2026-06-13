import type { DamageType, EnemyInstance } from '@dungeon/contracts';

/**
 * Single source of truth for damage-type display colors in the presenter.
 * Both the map view and the inspect/game view must derive enemy colors here
 * so the same enemy never renders with different colors per builder.
 */
export const DAMAGE_TYPE_COLORS: Readonly<Partial<Record<DamageType, string>>> = {
  fire: '#ff4400',
  frost: '#44aaff',
  poison: '#44ff44',
  shock: '#ffff00',
  corruption: '#aa44ff',
  arcane: '#dd44ff',
  shadow: '#333366',
};

export const DEFAULT_ENEMY_COLOR = '#ff4444';

export function getDamageTypeColor(damageType: DamageType): string {
  return DAMAGE_TYPE_COLORS[damageType] ?? DEFAULT_ENEMY_COLOR;
}

/** Enemy display color: prefer the template-provided color, else weapon damage type. */
export function getEnemyColor(enemy: EnemyInstance): string {
  if (enemy.color) return enemy.color;

  const damageType = enemy.equipment?.weapon?.damageType ?? 'physical';
  return getDamageTypeColor(damageType);
}
