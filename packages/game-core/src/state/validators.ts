import type { GameState, RunState, Player, EnemyInstance, WorldState } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { RING_SPELL_BY_ID } from '@dungeon/content';
import { ALL_ABILITY_DEFINITIONS } from '../abilities/definitions/index.js';

const ABILITY_IDS = new Set(ALL_ABILITY_DEFINITIONS.map(definition => definition.id));

export interface ValidationError {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
}

/**
 * Validate a GameState for structural and logical consistency.
 * Returns a result object with isValid flag and detailed error list.
 */
export function validateGameState(state: GameState): ValidationResult {
  const mutableErrors: ValidationError[] = [];

  // Check required fields
  if (typeof state.gameId !== 'string' || state.gameId === '') {
    mutableErrors.push({ path: 'gameId', message: 'gameId is required and must be non-empty' });
  }

  if (typeof state.phase !== 'string' || (state.phase !== 'town' && state.phase !== 'dungeon')) {
    mutableErrors.push({ path: 'phase', message: 'phase must be either "town" or "dungeon"' });
  }

  if (typeof state.version !== 'number' || state.version < 0) {
    mutableErrors.push({ path: 'version', message: 'version must be non-negative' });
  }

  if (typeof state.turnNumber !== 'number' || state.turnNumber < 0) {
    mutableErrors.push({ path: 'turnNumber', message: 'turnNumber must be non-negative' });
  }

  mutableErrors.push(...validatePlayer(state.player).map(e => ({ ...e, path: `player.${e.path}` })));
  mutableErrors.push(...validateWorldState(state.world).map(e => ({ ...e, path: `world.${e.path}` })));
  mutableErrors.push(...validateInventoryReferences(state));
  mutableErrors.push(...validateEquipmentReferences(state));

  // Validate run if present
  if (state.run !== null) {
    mutableErrors.push(...validateRunState(state.run).map(e => ({ ...e, path: `run.${e.path}` })));
  }

  // If in dungeon phase, should have a run
  if (state.phase === 'dungeon' && state.run === null) {
    mutableErrors.push({ path: 'phase', message: 'dungeon phase requires an active run' });
  }

  // If in town phase, should not have a run
  if (state.phase === 'town' && state.run !== null) {
    mutableErrors.push({ path: 'phase', message: 'town phase should not have an active run' });
  }

  return {
    isValid: mutableErrors.length === 0,
    errors: mutableErrors,
  };
}

/**
 * Validate a Player object
 */
export function validatePlayer(player: Player): ValidationError[] {
  const mutableErrors: ValidationError[] = [];
  const playerRecord = player as unknown as Record<string, unknown>;

  if (typeof player.id !== 'string' || player.id === '') {
    mutableErrors.push({ path: 'id', message: 'player id is required and must be non-empty' });
  }

  if (typeof player.level !== 'number' || player.level < 1) {
    mutableErrors.push({ path: 'level', message: 'player level must be at least 1' });
  }

  if (typeof player.experience !== 'number' || player.experience < 0) {
    mutableErrors.push({ path: 'experience', message: 'experience must be non-negative' });
  }

  const stats = playerRecord['stats'];
  if (!isRecord(stats)) {
    mutableErrors.push({ path: 'stats', message: 'player stats are required' });
  } else {
    if (typeof stats['maxHealth'] !== 'number' || stats['maxHealth'] <= 0) {
      mutableErrors.push({ path: 'stats.maxHealth', message: 'maxHealth must be positive' });
    }

    if (typeof stats['health'] !== 'number' || stats['health'] < 0) {
      mutableErrors.push({ path: 'stats.health', message: 'health must be non-negative' });
    }

    if (
      typeof stats['health'] === 'number'
      && typeof stats['maxHealth'] === 'number'
      && stats['health'] > stats['maxHealth']
    ) {
      mutableErrors.push({ path: 'stats.health', message: 'health cannot exceed maxHealth' });
    }

    if (typeof stats['attack'] !== 'number' || stats['attack'] < 0) {
      mutableErrors.push({ path: 'stats.attack', message: 'attack must be non-negative' });
    }

    if (typeof stats['defense'] !== 'number' || stats['defense'] < 0) {
      mutableErrors.push({ path: 'stats.defense', message: 'defense must be non-negative' });
    }
  }

  const position = playerRecord['position'];
  if (!isRecord(position) || typeof position['x'] !== 'number' || typeof position['y'] !== 'number') {
    mutableErrors.push({ path: 'position', message: 'position is required and must have valid x and y coordinates' });
  }

  if (typeof player.gold !== 'number' || player.gold < 0) {
    mutableErrors.push({ path: 'gold', message: 'gold must be non-negative' });
  }

  if (typeof player.mana !== 'number' || !Number.isFinite(player.mana) || player.mana < 0) {
    mutableErrors.push({ path: 'mana', message: 'mana must be finite and non-negative' });
  }

  if (typeof player.maxMana !== 'number' || !Number.isFinite(player.maxMana) || player.maxMana < 0) {
    mutableErrors.push({ path: 'maxMana', message: 'maxMana must be finite and non-negative' });
  }

  const learnedRingSpellIds = playerRecord['learnedRingSpellIds'];
  if (!Array.isArray(learnedRingSpellIds)) {
    mutableErrors.push({ path: 'learnedRingSpellIds', message: 'learned ring spell ids must be an array' });
  } else {
    for (const spellId of learnedRingSpellIds) {
      if (typeof spellId !== 'string' || !RING_SPELL_BY_ID.has(spellId)) {
        mutableErrors.push({ path: `learnedRingSpellIds.${String(spellId)}`, message: 'learned ring spell id must exist in content' });
      }
    }
  }

  const abilities = playerRecord['abilities'];
  if (!Array.isArray(abilities)) {
    mutableErrors.push({ path: 'abilities', message: 'abilities must be an array' });
  } else {
    for (const ability of abilities) {
      if (!isRecord(ability) || typeof ability['id'] !== 'string') {
        mutableErrors.push({ path: 'abilities', message: 'ability entries must be objects with string ids' });
        continue;
      }
      const abilityId = ability['id'];
      if (!ABILITY_IDS.has(abilityId)) {
        mutableErrors.push({ path: `abilities.${abilityId}`, message: 'ability id must exist in game-core definitions' });
      }
      if (
        typeof ability['cooldownRemaining'] !== 'number'
        || !Number.isFinite(ability['cooldownRemaining'])
        || ability['cooldownRemaining'] < 0
      ) {
        mutableErrors.push({ path: `abilities.${abilityId}.cooldownRemaining`, message: 'ability cooldown must be finite and non-negative' });
      }
    }
  }

  const ringMastery = playerRecord['ringMastery'];
  if (!isRecord(ringMastery)) {
    mutableErrors.push({ path: 'ringMastery', message: 'ring mastery must be an object' });
    return mutableErrors;
  }

  for (const [school, mastery] of Object.entries(ringMastery)) {
    if (typeof mastery !== 'object' || mastery === null) {
      mutableErrors.push({ path: `ringMastery.${school}`, message: 'ring mastery entries must be exactly { xp: finite non-negative number }' });
      continue;
    }

    const masteryRecord = mastery as Record<string, unknown>;
    const keys = Object.keys(masteryRecord);
    if (
      keys.length !== 1
      || keys[0] !== 'xp'
      || typeof masteryRecord.xp !== 'number'
      || !Number.isFinite(masteryRecord.xp)
      || masteryRecord.xp < 0
    ) {
      mutableErrors.push({ path: `ringMastery.${school}`, message: 'ring mastery entries must be exactly { xp: finite non-negative number }' });
    }
  }

  return mutableErrors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateInventoryReferences(state: GameState): ValidationError[] {
  const mutableErrors: ValidationError[] = [];
  for (const entityId of state.player.inventory) {
    if (!state.itemRegistry.items.has(entityId)) {
      mutableErrors.push({ path: `player.inventory.${entityId}`, message: 'inventory item entity id must exist in itemRegistry' });
    }
  }
  return mutableErrors;
}

function validateEquipmentReferences(state: GameState): ValidationError[] {
  const mutableErrors: ValidationError[] = [];
  for (const [slot, entityId] of Object.entries(state.player.equipment)) {
    if (entityId !== null && !state.itemRegistry.items.has(entityId)) {
      mutableErrors.push({ path: `player.equipment.${slot}`, message: 'equipment item entity id must exist in itemRegistry' });
    }
  }
  return mutableErrors;
}

/**
 * Validate a RunState object
 */
export function validateRunState(run: RunState): ValidationError[] {
  const mutableErrors: ValidationError[] = [];

  if (typeof run.runId !== 'string' || run.runId === '') {
    mutableErrors.push({ path: 'runId', message: 'runId is required and must be non-empty' });
  }

  if (typeof run.turnCount !== 'number' || run.turnCount < 0) {
    mutableErrors.push({ path: 'turnCount', message: 'turnCount must be non-negative' });
  }

  if (typeof run.isActive !== 'boolean') {
    mutableErrors.push({ path: 'isActive', message: 'isActive must be boolean' });
  }

  // run.floor, run.enemies, and run.speedAccumulators are required by type
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition
  if (run.enemies && typeof run.enemies[Symbol.iterator] === 'function') {
    for (const [key, enemy] of run.enemies) {
      mutableErrors.push(...validateEnemy(enemy).map(e => ({ ...e, path: `enemies.${key}.${e.path}` })));
      const cell = run.floor.cells.get(posKey(enemy.position));
      if (cell === undefined) {
        mutableErrors.push({
          path: `enemies.${key}.position`,
          message: 'enemy position must reference an existing floor cell',
        });
      } else if (cell.tile.walkable !== true) {
        mutableErrors.push({
          path: `enemies.${key}.position`,
          message: 'enemy position must be on a walkable tile',
        });
      }
    }
  } else {
    mutableErrors.push({ path: 'enemies', message: 'enemies must be a Map' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
  if (typeof run.speedAccumulators !== 'object' || !run.speedAccumulators) {
    mutableErrors.push({ path: 'speedAccumulators', message: 'speedAccumulators is required and must be an object' });
  }

  return mutableErrors;
}

/**
 * Validate an EnemyInstance object
 */
export function validateEnemy(enemy: EnemyInstance): ValidationError[] {
  const mutableErrors: ValidationError[] = [];

  if (typeof enemy.id !== 'string' || enemy.id === '') {
    mutableErrors.push({ path: 'id', message: 'enemy id is required and must be non-empty' });
  }

  if (typeof enemy.templateId !== 'string' || enemy.templateId === '') {
    mutableErrors.push({ path: 'templateId', message: 'templateId is required and must be non-empty' });
  }

  if (typeof enemy.tier !== 'number' || enemy.tier < 0) {
    mutableErrors.push({ path: 'tier', message: 'tier must be non-negative' });
  }

  // enemy.position is required by type
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
  if (!enemy.position || typeof enemy.position.x !== 'number' || typeof enemy.position.y !== 'number') {
    mutableErrors.push({ path: 'position', message: 'position is required and must have valid x and y coordinates' });
  }

  // enemy.archetype is required by type
  if (typeof enemy.archetype !== 'string' || enemy.archetype === '') {
    mutableErrors.push({ path: 'archetype', message: 'archetype is required and must be non-empty' });
  }

  // enemy.stats is required by type
  if (typeof enemy.stats.maxHealth !== 'number' || enemy.stats.maxHealth <= 0) {
    mutableErrors.push({ path: 'stats.maxHealth', message: 'maxHealth must be positive' });
  }

  if (typeof enemy.stats.health !== 'number' || enemy.stats.health < 0) {
    mutableErrors.push({ path: 'stats.health', message: 'health must be non-negative' });
  }

  if (enemy.stats.health > enemy.stats.maxHealth) {
    mutableErrors.push({ path: 'stats.health', message: 'health cannot exceed maxHealth' });
  }

  return mutableErrors;
}

/**
 * Validate a WorldState object
 */
export function validateWorldState(world: WorldState): ValidationError[] {
  const mutableErrors: ValidationError[] = [];

  // town is required by type
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
  if (typeof world.town !== 'object' || !world.town) {
    mutableErrors.push({ path: 'town', message: 'town is required and must be an object' });
  }

  if (typeof world.totalRuns !== 'number' || world.totalRuns < 0) {
    mutableErrors.push({ path: 'totalRuns', message: 'totalRuns must be non-negative' });
  }

  if (typeof world.deepestFloor !== 'number' || world.deepestFloor < 0) {
    mutableErrors.push({ path: 'deepestFloor', message: 'deepestFloor must be non-negative' });
  }

  // Validate factions array
  if (!Array.isArray(world.factions)) {
    mutableErrors.push({ path: 'factions', message: 'factions must be an array' });
  } else {
    for (const faction of world.factions) {
      if (typeof faction.id !== 'string' || faction.id === '') {
        mutableErrors.push({ path: 'factions.id', message: 'each faction must have a non-empty id' });
      }
      if (typeof faction.status !== 'string' || !['leaderless', 'led', 'broken'].includes(faction.status)) {
        mutableErrors.push({ path: 'factions.status', message: 'faction status must be one of: leaderless, led, broken' });
      }
      if (typeof faction.power !== 'number' || faction.power < 0 || faction.power > 100) {
        mutableErrors.push({ path: 'factions.power', message: 'faction power must be between 0 and 100' });
      }
      if (typeof faction.leaderSlain !== 'boolean') {
        mutableErrors.push({ path: 'factions.leaderSlain', message: 'faction leaderSlain must be a boolean' });
      }
    }
  }

  // Validate dungeonOgre
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof world.dungeonOgre !== 'object' || world.dungeonOgre === null) {
    mutableErrors.push({ path: 'dungeonOgre', message: 'dungeonOgre is required and must be an object' });
  } else {
    if (typeof world.dungeonOgre.status !== 'string' || !['sealed', 'emerged', 'slain'].includes(world.dungeonOgre.status)) {
      mutableErrors.push({ path: 'dungeonOgre.status', message: 'dungeonOgre status must be one of: sealed, emerged, slain' });
    }
    if (world.dungeonOgre.status === 'emerged') {
      if (typeof world.dungeonOgre.selectedSpawnDepth !== 'number' || world.dungeonOgre.selectedSpawnDepth <= 0) {
        mutableErrors.push({ path: 'dungeonOgre.selectedSpawnDepth', message: 'dungeonOgre selectedSpawnDepth must be a positive integer when status is emerged' });
      }
    }
  }

  return mutableErrors;
}

/**
 * Check if a state is valid (convenience wrapper)
 */
export function isGameStateValid(state: GameState): boolean {
  return validateGameState(state).isValid;
}
