import type { FactionState, WorldState } from '@dungeon/contracts';
import {
  FEAR_MODIFIERS,
  CORRUPTION_MODIFIERS,
  WORLD_MODIFIER_CAPS,
} from '@dungeon/content';
import { getFactionSpawnWeightMultiplier } from './factions.js';

/** Modifiers derived from world state, passed to floor generation */
export interface WorldModifiers {
  readonly extraEnemies: number;
  readonly preferredArchetypes: readonly string[];
  readonly preferredDamageTypes: readonly string[];
  readonly factionWeightMultipliers: Readonly<Record<string, number>>;
  readonly factions: readonly FactionState[];
  readonly enemyHealthMultiplier: number;
  readonly tierUpgradeChance: number;
  readonly reservedEncounterSlots: number;
}

/** Compute world modifiers for a given floor depth */
export function buildWorldModifiers(
  world: WorldState,
  _depth: number,
  reservedEncounterSlots = 0,
): WorldModifiers {
  const extraEnemies = 0;
  const preferredArchetypes: readonly string[] =
    world.town.fear > FEAR_MODIFIERS.preferFastEnemiesAbove ? FEAR_MODIFIERS.preferredArchetypes : [];
  const preferredDamageTypes: readonly string[] =
    world.town.corruption > CORRUPTION_MODIFIERS.preferCorruptEnemiesAbove ? CORRUPTION_MODIFIERS.preferredDamageTypes : [];

  const factionWeightMultipliers = Object.fromEntries(
    world.factions.map(faction => [faction.id, getFactionSpawnWeightMultiplier(faction)]),
  );

  let enemyHealthMultiplier = 1.0;
  let tierUpgradeChance = 0;

  if (world.town.corruption > CORRUPTION_MODIFIERS.enemyHealthBonusAbove) {
    enemyHealthMultiplier = CORRUPTION_MODIFIERS.enemyHealthMultiplier;
  }
  if (world.town.corruption > CORRUPTION_MODIFIERS.tierUpgradeChanceAbove) {
    tierUpgradeChance = CORRUPTION_MODIFIERS.tierUpgradeChance;
  }

  return {
    extraEnemies: Math.min(WORLD_MODIFIER_CAPS.maxExtraEnemies, extraEnemies),
    preferredArchetypes,
    preferredDamageTypes,
    factionWeightMultipliers,
    factions: world.factions,
    enemyHealthMultiplier,
    tierUpgradeChance,
    reservedEncounterSlots,
  };
}
