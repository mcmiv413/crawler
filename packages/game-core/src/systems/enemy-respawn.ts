import type { GameState, DomainEvent, EnemyTemplate, EnemyInstance, DungeonFloor, StoredFloor } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { ENEMY_RESPAWN } from '@dungeon/content';
import type { BiomeDefinition } from '@dungeon/content';
import { ENEMIES_BY_BIOME, getFloorScalingMultipliers } from '@dungeon/content';
import { chebyshevDistance } from '../utils/grid.js';
import { type SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import { generateId } from '../utils/id.js';
import { computeFov } from './fov.js';
import { preSimulateAmbientBehavior } from './ambient-behavior-engine.js';
import { AMBIENT_PROFILES } from '@dungeon/content';

/**
 * Check if enemies should respawn this turn.
 * Respawns are triggered at regular intervals and respect max count cap.
 * Bosses never respawn.
 */
export function checkRespawn(
  state: GameState,
  biome: BiomeDefinition,
  rng: SeededRNG,
): { state: GameState; events: DomainEvent[] } {
  if (state.run === null) return { state, events: [] };

  let events: DomainEvent[] = [];
  let newState = state;

  // Check if respawn interval has been reached
  const intervalReached = state.run.turnCount % ENEMY_RESPAWN.respawnIntervalTurns === 0 && state.run.turnCount > 0;
  if (intervalReached !== true) {
    return { state, events };
  }

  // Count alive enemies
  const aliveCount = state.run.enemies.size;
  if (aliveCount >= ENEMY_RESPAWN.maxEnemiesOnFloor) {
    return { state, events };
  }

  // Find walkable tiles that can spawn enemies:
  // 1. Not occupied by enemy or player
  // 2. Not in player FOV
  // 3. Far enough from player (>= minSpawnDistFromPlayer)
  const updatedFloor = computeFov(state.run.floor, state.player.position);
  const playerFov = new Set<string>(
    Array.from(updatedFloor).filter(([, cell]) => cell.visibility === 'visible').map(([key]) => key)
  );
  const candidateSpawns: { x: number; y: number }[] = Array.from(state.run.floor.cells)
    .filter(([key, cell]) => {
      if (cell.tile.walkable !== true) return false;
      const [x, y] = key.split(',').map(Number);
      if (x === undefined || y === undefined) return false;
      if (state.run!.enemies.has(key) || (state.player.position.x === x && state.player.position.y === y)) {
        return false;
      }
      if (playerFov.has(key)) return false;
      if (chebyshevDistance({ x, y }, state.player.position) < ENEMY_RESPAWN.minSpawnDistFromPlayer) {
        return false;
      }
      return true;
    })
    .map(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x!, y: y! };
    });

  // Spawn 1 enemy per respawn tick (or fewer if no valid spawns)
  let remainingSpawns = candidateSpawns;
  for (let i = 0; i < ENEMY_RESPAWN.respawnCountPerTick && remainingSpawns.length > 0; i++) {
    // Pick random spawn location
    const spawnIdx = rng.int(0, remainingSpawns.length - 1);
    const spawnPos = remainingSpawns[spawnIdx]!;
    remainingSpawns = [...remainingSpawns.slice(0, spawnIdx), ...remainingSpawns.slice(spawnIdx + 1)];

    // Pick enemy template (biome pool, filter out bosses)
    let template = pickEnemy(biome, rng);
    if (template === null) continue;

    while (template.archetype === 'boss') {
      template = pickEnemy(biome, rng);
      if (template === null) break;
    }
    if (template === null) continue;

    // Instantiate enemy
    const newEnemy = instantiateEnemy(template, spawnPos, state.run.floor.depth, rng);

    // Update state
    const newEnemies = new Map(newState.run!.enemies);
    newEnemies.set(posKey(spawnPos), newEnemy);

    newState = {
      ...newState,
      run: { ...newState.run!, enemies: newEnemies },
    };

    // Emit event
    events = [...events, {
      type: 'ENEMY_SPAWNED',
      enemyId: newEnemy.id,
      enemyName: newEnemy.name,
      position: spawnPos,
      reason: 'respawn',
      timestamp: Date.now(),
      turnNumber: state.turnNumber,
    }];
  }

  return { state: newState, events };
}

/**
 * Pick a random enemy template from the biome pool.
 */
function pickEnemy(biome: BiomeDefinition, rng: SeededRNG): EnemyTemplate | null {
  const pool = ENEMIES_BY_BIOME.get(biome.biomeId) ?? [];
  if (pool.length === 0) return null;

  return rng.pick(pool);
}

/**
 * Instantiate an enemy instance from a template.
 */
function instantiateEnemy(
  template: EnemyTemplate,
  position: { x: number; y: number },
  depth: number,
  _rng: SeededRNG,
): EnemyInstance {
  const multipliers = getFloorScalingMultipliers(depth);
  const scale = (base: number, multiplier: number): number =>
    Math.round(base * Math.pow(multiplier, depth - 1));

  const scaledMaxHealth = Math.round(scale(template.stats.maxHealth, multipliers.healthMultiplier));

  const abilities = template.abilities ?? [];

  // Initialize ability cooldowns to 0 (ready to use immediately)
  const abilityCooldowns: Record<string, number> = {};
  for (const abilityId of abilities) {
    abilityCooldowns[abilityId] = 0;
  }

  return {
    id: entityId(generateId()),
    templateId: template.templateId,
    name: template.name,
    archetype: template.archetype,
    tier: template.tier,
    stats: {
      maxHealth: scaledMaxHealth,
      health: scaledMaxHealth,
      attack: scale(template.stats.attack, multipliers.attackMultiplier),
      defense: scale(template.stats.defense, multipliers.defenseMultiplier),
      accuracy: template.stats.accuracy,
      evasion: template.stats.evasion,
      speed: template.stats.speed,
    },
    equipment: template.equipment,
    affinities: { ...template.affinities },
    spawn: template.spawn,
    abilities: abilities.length > 0 ? abilities : undefined,
    abilityCooldowns,
    lootTableId: template.lootTableId,
    experienceValue: Math.round(template.experienceValue * Math.pow(multipliers.experienceMultiplier, depth - 1)),
    description: template.description,
    ascii: template.ascii,
    position,
    statuses: [],
    isAlerted: false,
    lastKnownPlayerPos: null,
  };
}

/**
 * Respawn enemies on a cached floor based on time elapsed and original enemy count.
 * Respawns at a fixed rate and cap at 50% of original count.
 */
export function respawnEnemiesOnPersistedFloor(
  floor: DungeonFloor,
  currentEnemies: ReadonlyMap<string, EnemyInstance>,
  originalEnemyCount: number,
  biome: BiomeDefinition,
  depth: number,
  turnsSinceVisit: number,
  rng: SeededRNG,
): ReadonlyMap<string, EnemyInstance> {
  // Calculate how many enemies should respawn based on time elapsed
  const respawnInterval = 15; // Base interval; can be adjusted per biome
  const respawnsWorth = Math.floor(turnsSinceVisit / respawnInterval);

  // Cap respawned enemies at 50% of original count
  const maxRespawns = Math.floor(originalEnemyCount * 0.5);
  const enemiesKilled = originalEnemyCount - currentEnemies.size;
  const eligibleRespawns = Math.min(respawnsWorth, enemiesKilled, maxRespawns - (currentEnemies.size - (originalEnemyCount - enemiesKilled)));

  let newEnemies = new Map(currentEnemies);

  // Find walkable spawn tiles not in current FOV (simulate from entrance)
  const visibleCells = computeFov(floor, floor.entrance);
  const playerFov = new Set<string>(
    Array.from(visibleCells).filter(([, cell]) => cell.visibility === 'visible').map(([key]) => key)
  );

  const candidateSpawns: { x: number; y: number }[] = Array.from(floor.cells)
    .filter(([key, cell]) => {
      if (cell.tile.walkable !== true) return false;
      const [x, y] = key.split(',').map(Number);
      if (x === undefined || y === undefined) return false;
      if (newEnemies.has(key)) return false;
      if (playerFov.has(key)) return false;
      // Spawn away from entrance
      if (chebyshevDistance({ x, y }, floor.entrance) < 5) return false;
      return true;
    })
    .map(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return { x: x!, y: y! };
    });

  // Spawn respawned enemies
  let mutableCandidateSpawns = [...candidateSpawns];
  for (let i = 0; i < eligibleRespawns && mutableCandidateSpawns.length > 0; i++) {
    const spawnIdx = rng.int(0, mutableCandidateSpawns.length - 1);
    const spawnPos = mutableCandidateSpawns[spawnIdx]!;
    mutableCandidateSpawns = mutableCandidateSpawns.filter((_, idx) => idx !== spawnIdx);

    // Pick enemy template from biome (no bosses)
    let template: EnemyTemplate | null = pickEnemy(biome, rng);
    while (template && template.archetype === 'boss') {
      template = pickEnemy(biome, rng);
    }
    if (template === null) continue;

    const newEnemy = instantiateEnemy(template, spawnPos, depth, rng);
    newEnemies.set(posKey(spawnPos), newEnemy);
  }

  return newEnemies;
}

/**
 * Simulate a floor's time passage: respawn enemies and run ambient behavior.
 * Returns the floor state as if the given number of turns have passed.
 */
export function simulatePersistedFloorTimeElapsed(
  storedFloor: StoredFloor,
  turnsSinceVisit: number,
  biome: BiomeDefinition,
  depth: number,
  rng: SeededRNG,
): StoredFloor {
  const originalCount = storedFloor.originalEnemyCount ?? 0;

  // Respawn enemies based on time elapsed
  const respawnedEnemies = respawnEnemiesOnPersistedFloor(
    storedFloor.floor,
    storedFloor.enemies,
    originalCount,
    biome,
    depth,
    turnsSinceVisit,
    rng,
  );

  // Run 10 turns of ambient behavior simulation so enemies aren't idle on re-entry
  const simulatedEnemies = preSimulateAmbientBehavior(
    new Map(respawnedEnemies),
    AMBIENT_PROFILES,
    10,
    storedFloor.floor.seed,
  );

  return {
    ...storedFloor,
    enemies: simulatedEnemies,
    lastSimulatedTurn: turnsSinceVisit,
  };
}

