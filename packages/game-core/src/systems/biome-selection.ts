import type { FactionPowerBand, FactionState } from '@dungeon/contracts';
import {
  BIOME_DEFINITIONS,
  ENEMIES_BY_BIOME,
  FACTION_CONFIG,
  stoneCrypt,
  type BiomeDefinition,
} from '@dungeon/content';

export function selectBiomeForFloor(
  depth: number,
  world: { readonly factions: readonly FactionState[] },
  rng?: { next(): number },
): BiomeDefinition {
  const candidates = Array.from(BIOME_DEFINITIONS.values()).filter(
    b => depth >= b.floorRange.min && depth <= b.floorRange.max,
  );
  if (candidates.length === 0) return stoneCrypt;
  if (candidates.length === 1) return candidates[0]!;

  const factionsById = new Map(world.factions.map(faction => [faction.id, faction]));
  const weights = candidates.map(candidate => getBiomeFactionWeight(candidate, depth, factionsById));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  if (rng === undefined) return candidates[0]!;

  let roll = rng.next() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return candidates[i]!;
  }

  return candidates[candidates.length - 1]!;
}

function getBiomeFactionWeight(
  biome: BiomeDefinition,
  depth: number,
  factionsById: ReadonlyMap<string, FactionState>,
): number {
  const eligibleTemplates = (ENEMIES_BY_BIOME.get(biome.biomeId) ?? [])
    .filter(template => {
      const [minDepth, maxDepth] = template.spawn.floorRange;
      return template.archetype !== 'boss' && depth >= minDepth && depth <= maxDepth;
    });

  if (eligibleTemplates.length === 0) {
    return 0.25;
  }

  return eligibleTemplates.reduce((weight, template) => {
    const factionId = template.factions?.[0]?.factionId;
    if (factionId === undefined) {
      return weight + 0.5;
    }

    const faction = factionsById.get(factionId);
    return weight + (faction === undefined ? 1 : getFactionBiomeMultiplier(faction));
  }, 1);
}

function getFactionBiomeMultiplier(faction: FactionState): number {
  const band = getFactionPowerBand(faction);
  const baseMultiplier = FACTION_CONFIG.spawning.weightMultiplierByBand[band];
  return faction.status === 'led' ? baseMultiplier * 1.15 : baseMultiplier;
}

function getFactionPowerBand(faction: FactionState): FactionPowerBand {
  if (faction.status === 'broken') {
    return 'broken';
  }
  if (faction.power <= FACTION_CONFIG.power.bands.weakMax) {
    return 'weak';
  }
  if (faction.power <= FACTION_CONFIG.power.bands.stableMax) {
    return 'stable';
  }
  if (faction.power <= FACTION_CONFIG.power.bands.strongMax) {
    return 'strong';
  }
  return 'dominant';
}
