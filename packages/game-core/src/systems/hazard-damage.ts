import type { ObjectTemplate, DamageType } from '@dungeon/contracts';

/**
 * Calculate hazard damage based on target's max health and hazard rarity.
 * Damage scales as a percentage of max health:
 * - common: 10%
 * - uncommon: 15%
 * - rare: 20%
 * - epic: 25%
 * - legendary: 30%
 */
export function calculateHazardDamage(template: ObjectTemplate, targetMaxHealth: number): number {
  if (template.rarity === undefined) {
    return Math.max(1, template.healthDelta !== 0 ? Math.abs(template.healthDelta) : 0);
  }

  const percentageMap: Record<string, number> = {
    common: 0.1,
    uncommon: 0.15,
    rare: 0.2,
    epic: 0.3,
    legendary: 0.4,
  };

  const percentage = percentageMap[template.rarity] ?? 0.1;
  return Math.max(1, Math.floor(targetMaxHealth * percentage));
}

/** Map hazard types to damage types for resistance calculations */
export function hazardTypeToDamageType(hazardType: NonNullable<ObjectTemplate['hazardType']>): DamageType {
  const map: Record<NonNullable<ObjectTemplate['hazardType']>, DamageType> = {
    spike: 'physical',
    fire: 'fire',
    poison: 'poison',
    frost: 'frost',
    lightning: 'shock',
  };
  return map[hazardType];
}
