import type { DungeonFloor, EnemyInstance, ObjectInstance, Position } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import type { EnemyTemplate, ObjectTemplate } from '@dungeon/contracts';
import { MAP_GENERATION, ENEMIES_BY_BIOME, OBJECT_TEMPLATES, AMBIENT_PROFILES, OBJECT_POOL, chest } from '@dungeon/content';
import type { BiomeDefinition } from '@dungeon/content';
import type { SeededRNG } from '../utils/rng.js';
import { chebyshevDistance } from '../utils/grid.js';
import type { WorldModifiers } from '../systems/world-modifiers.js';
import { preSimulateAmbientBehavior } from '../systems/ambient-behavior-engine.js';
import { generateId } from '../utils/id.js';
import { createEnemyInstance, assignInstanceColors } from './enemy-instantiation.js';

export interface PopulatedFloor {
  readonly enemies: ReadonlyMap<string, EnemyInstance>;
  readonly objects: ReadonlyMap<string, ObjectInstance>;
}

interface WeightedTemplate {
  readonly template: EnemyTemplate;
  readonly weight: number;
}

/** Populate a floor with enemies and items */
export function populateFloor(
  floor: DungeonFloor,
  biome: BiomeDefinition,
  rng: SeededRNG,
  worldMods?: WorldModifiers,
): PopulatedFloor {
  const walkablePositions = getWalkablePositions(floor);
  const spawnPositions = walkablePositions.filter(pos => {
    const key = posKey(pos);
    if (key === posKey(floor.exit)) return false;
    if (chebyshevDistance(pos, floor.entrance) <= 2) return false;
    return true;
  });

  const shuffled = rng.shuffle(spawnPositions);
  const baseMax = MAP_GENERATION.enemyBaseDensity + MAP_GENERATION.enemyPerFloor * floor.depth;
  const maxEnemies = baseMax + (worldMods?.extraEnemies ?? 0);
  const reservedEncounterSlots = worldMods?.reservedEncounterSlots ?? 0;
  const enemyCount = Math.max(0, Math.min(maxEnemies - reservedEncounterSlots, Math.floor(shuffled.length * 0.15)));
  const enemies = new Map<string, EnemyInstance>();

  for (let i = 0; i < enemyCount && i < shuffled.length; i++) {
    const pos = shuffled[i]!;
    let template = pickEnemy(biome, rng, floor.depth, worldMods);
    if (template === null) continue;

    if (worldMods?.tierUpgradeChance !== undefined && rng.next() < worldMods.tierUpgradeChance) {
      const currentTemplate = template;
      const biomePool = ENEMIES_BY_BIOME.get(biome.biomeId) ?? [];
      const upgradedCandidates = biomePool.filter((candidate): candidate is EnemyTemplate =>
        candidate.archetype !== 'boss' && candidate.tier > currentTemplate.tier,
      );

      if (upgradedCandidates.length > 0) {
        template = rng.pick(upgradedCandidates);
      }
    }

    const enemy = createEnemyInstance(template, pos, floor.depth, {
      factions: worldMods?.factions,
      enemyHealthMultiplier: worldMods?.enemyHealthMultiplier,
    });
    enemies.set(posKey(pos), enemy);
  }

  const maxObjects = MAP_GENERATION.itemBaseDensity + MAP_GENERATION.itemPerFloor * floor.depth;
  const objectPositions = shuffled.slice(enemyCount);
  const objects = new Map<string, ObjectInstance>();

  for (let i = 0; i < maxObjects && i < objectPositions.length; i++) {
    const pos = objectPositions[i]!;
    const objectTemplate = pickObject(rng, floor.depth);
    if (objectTemplate === undefined) continue;

    objects.set(posKey(pos), {
      id: entityId(generateId()),
      templateId: objectTemplate.templateId,
      position: pos,
      isExhausted: false,
    });
  }

  const coloredEnemies = new Map(assignInstanceColors(enemies));
  const simulatedEnemies = preSimulateAmbientBehavior(coloredEnemies, floor, AMBIENT_PROFILES, 10, floor.seed);
  const safeEnemies = enforceSpawnSafety(floor, coloredEnemies, simulatedEnemies);

  return { enemies: safeEnemies, objects };
}

function enforceSpawnSafety(
  floor: DungeonFloor,
  originalEnemies: ReadonlyMap<string, EnemyInstance>,
  simulatedEnemies: ReadonlyMap<string, EnemyInstance>,
): ReadonlyMap<string, EnemyInstance> {
  const safeEnemies = new Map<string, EnemyInstance>();
  const availableFallbackPositions = new Map<string, Position>();
  const originalPositionById = new Map<string, Position>();

  for (const enemy of originalEnemies.values()) {
    availableFallbackPositions.set(posKey(enemy.position), enemy.position);
    originalPositionById.set(enemy.id, enemy.position);
  }

  for (const enemy of simulatedEnemies.values()) {
    const currentKey = posKey(enemy.position);
    const currentIsSafe = isSafeSpawnPosition(floor, enemy.position) && safeEnemies.has(currentKey) === false;
    let nextPosition = enemy.position;

    if (currentIsSafe === false) {
      const originalPosition = originalPositionById.get(enemy.id);
      const originalKey = originalPosition === undefined ? null : posKey(originalPosition);
      if (originalPosition !== undefined && originalKey !== null && availableFallbackPositions.has(originalKey)) {
        nextPosition = originalPosition;
      } else {
        const firstFallback = availableFallbackPositions.values().next().value;
        if (firstFallback !== undefined) {
          nextPosition = firstFallback;
        }
      }
    }

    safeEnemies.set(posKey(nextPosition), { ...enemy, position: nextPosition });
    availableFallbackPositions.delete(posKey(nextPosition));
  }

  return safeEnemies;
}

function isSafeSpawnPosition(floor: DungeonFloor, position: Position): boolean {
  return posKey(position) !== posKey(floor.entrance)
    && posKey(position) !== posKey(floor.exit)
    && chebyshevDistance(position, floor.entrance) > 2;
}

function getWalkablePositions(floor: DungeonFloor): Position[] {
  return Array.from(floor.cells)
    .filter(([, cell]) => cell.tile.walkable)
    .map(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x!, y: y! };
    });
}

function pickEnemy(
  biome: BiomeDefinition,
  rng: SeededRNG,
  depth: number,
  worldMods?: WorldModifiers,
): EnemyTemplate | null {
  const biomePool = ENEMIES_BY_BIOME.get(biome.biomeId) ?? [];
  if (biomePool.length === 0) return null;

  const preferredArchetypes = new Set(worldMods?.preferredArchetypes ?? []);
  const preferredDamageTypes = new Set(worldMods?.preferredDamageTypes ?? []);
  const factionWeightMultipliers = worldMods?.factionWeightMultipliers ?? {};

  let maxTier: number;
  if (depth <= 2) maxTier = 1;
  else if (depth <= 4) maxTier = 2;
  else maxTier = 5;

  const weightedPool = biomePool
    .filter(template => template.archetype !== 'boss' && template.tier <= maxTier)
    .map(template => {
      let weight = template.spawn.weight;
      if (preferredArchetypes.has(template.archetype)) weight *= 2;
      if (preferredDamageTypes.has(template.equipment.weapon.damageType)) weight *= 2;
      const primaryFactionId = template.factions?.[0]?.factionId;
      if (primaryFactionId !== undefined) {
        weight *= factionWeightMultipliers[primaryFactionId] ?? 1;
      }
      return { template, weight } satisfies WeightedTemplate;
    })
    .filter(candidate => candidate.weight > 0);

  if (weightedPool.length === 0) {
    return null;
  }

  return pickWeightedTemplate(weightedPool, rng);
}

function pickWeightedTemplate(weightedPool: readonly WeightedTemplate[], rng: SeededRNG): EnemyTemplate {
  const totalWeight = weightedPool.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = rng.next() * totalWeight;
  for (const candidate of weightedPool) {
    roll -= candidate.weight;
    if (roll <= 0) {
      return candidate.template;
    }
  }
  return weightedPool[weightedPool.length - 1]!.template;
}

function pickObject(rng: SeededRNG, depth: number): ObjectTemplate | undefined {
  const categoryPool = Object.entries(OBJECT_POOL.categoryWeights).flatMap(([category, weight]) =>
    Array.from({ length: weight }, () => category),
  );
  const selectedCategory = rng.pick(categoryPool) as 'trap' | 'chest' | 'healing' | 'misc';

  const categoryObjects = Array.from(OBJECT_TEMPLATES.values()).filter(
    (obj): obj is ObjectTemplate & { objectCategory: typeof selectedCategory } =>
      obj.objectCategory === selectedCategory,
  );

  if (categoryObjects.length === 0) return OBJECT_TEMPLATES.get(chest.templateId);

  const rarityGate = depth < OBJECT_POOL.rareMinDepth ? ['common', 'uncommon'] : Object.keys(OBJECT_POOL.rarityWeights);
  const gatedObjects = categoryObjects.filter(
    (obj): obj is ObjectTemplate => obj.rarity !== undefined && rarityGate.includes(obj.rarity),
  );

  if (gatedObjects.length === 0) return OBJECT_TEMPLATES.get('chest');

  const rarityPool = gatedObjects.flatMap((obj) => {
    const rarity = obj.rarity || 'common';
    const weight = (OBJECT_POOL.rarityWeights as Record<string, number>)[rarity] ?? 1;
    return Array.from({ length: weight }, () => obj);
  });

  return rng.pick(rarityPool);
}
