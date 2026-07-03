import type { GameState, RunState, Player, EnemyInstance, WorldState } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { RING_SPELL_BY_ID } from '@dungeon/content';
import { ALL_ABILITY_DEFINITIONS } from '../abilities/definitions/index.js';
import { isFiniteNumber, isRecord, validateContentRef } from './validation-guards.js';

const ABILITY_IDS = new Set(ALL_ABILITY_DEFINITIONS.map(definition => definition.id));

export interface ValidationError {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
}

function errorIf(condition: boolean, error: ValidationError): ValidationError[] {
  return condition === true ? [error] : [];
}

function prefixErrors(prefix: string, errors: readonly ValidationError[]): ValidationError[] {
  return errors.map(e => ({ ...e, path: `${prefix}.${e.path}` }));
}

/**
 * Validate a GameState for structural and logical consistency.
 * Returns a result object with isValid flag and detailed error list.
 */
export function validateGameState(state: GameState): ValidationResult {
  const errors = [
    ...errorIf(
      typeof state.gameId !== 'string' || state.gameId === '',
      { path: 'gameId', message: 'gameId is required and must be non-empty' },
    ),
    ...errorIf(
      typeof state.phase !== 'string' || (state.phase !== 'town' && state.phase !== 'dungeon'),
      { path: 'phase', message: 'phase must be either "town" or "dungeon"' },
    ),
    ...errorIf(
      typeof state.version !== 'number' || state.version < 0,
      { path: 'version', message: 'version must be non-negative' },
    ),
    ...errorIf(
      typeof state.turnNumber !== 'number' || state.turnNumber < 0,
      { path: 'turnNumber', message: 'turnNumber must be non-negative' },
    ),
    ...prefixErrors('player', validatePlayer(state.player)),
    ...prefixErrors('world', validateWorldState(state.world)),
    ...validateInventoryReferences(state),
    ...validateEquipmentReferences(state),
    ...(state.run !== null ? prefixErrors('run', validateRunState(state.run)) : []),
    ...errorIf(
      state.phase === 'dungeon' && state.run === null,
      { path: 'phase', message: 'dungeon phase requires an active run' },
    ),
    ...errorIf(
      state.phase === 'town' && state.run !== null,
      { path: 'phase', message: 'town phase should not have an active run' },
    ),
  ];

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a Player object
 */
export function validatePlayer(player: Player): ValidationError[] {
  const playerRecord = player as unknown as Record<string, unknown>;
  const stats = playerRecord['stats'];
  const position = playerRecord['position'];
  const learnedRingSpellIds = playerRecord['learnedRingSpellIds'];
  const abilities = playerRecord['abilities'];
  const ringMastery = playerRecord['ringMastery'];

  return [
    ...errorIf(
      typeof player.id !== 'string' || player.id === '',
      { path: 'id', message: 'player id is required and must be non-empty' },
    ),
    ...errorIf(
      typeof player.level !== 'number' || player.level < 1,
      { path: 'level', message: 'player level must be at least 1' },
    ),
    ...errorIf(
      typeof player.experience !== 'number' || player.experience < 0,
      { path: 'experience', message: 'experience must be non-negative' },
    ),
    ...validatePlayerStats(stats),
    ...errorIf(
      !isRecord(position) || typeof position['x'] !== 'number' || typeof position['y'] !== 'number',
      { path: 'position', message: 'position is required and must have valid x and y coordinates' },
    ),
    ...errorIf(
      typeof player.gold !== 'number' || player.gold < 0,
      { path: 'gold', message: 'gold must be non-negative' },
    ),
    ...errorIf(
      !isFiniteNumber(player.mana) || player.mana < 0,
      { path: 'mana', message: 'mana must be finite and non-negative' },
    ),
    ...errorIf(
      !isFiniteNumber(player.maxMana) || player.maxMana < 0,
      { path: 'maxMana', message: 'maxMana must be finite and non-negative' },
    ),
    ...validateLearnedRingSpellIds(learnedRingSpellIds),
    ...validatePlayerAbilities(abilities),
    ...validateRingMastery(ringMastery),
  ];
}

function validatePlayerStats(stats: unknown): ValidationError[] {
  if (!isRecord(stats)) {
    return [{ path: 'stats', message: 'player stats are required' }];
  }

  return [
    ...errorIf(
      typeof stats['maxHealth'] !== 'number' || stats['maxHealth'] <= 0,
      { path: 'stats.maxHealth', message: 'maxHealth must be positive' },
    ),
    ...errorIf(
      typeof stats['health'] !== 'number' || stats['health'] < 0,
      { path: 'stats.health', message: 'health must be non-negative' },
    ),
    ...errorIf(
      typeof stats['health'] === 'number'
      && typeof stats['maxHealth'] === 'number'
      && stats['health'] > stats['maxHealth'],
      { path: 'stats.health', message: 'health cannot exceed maxHealth' },
    ),
    ...errorIf(
      typeof stats['attack'] !== 'number' || stats['attack'] < 0,
      { path: 'stats.attack', message: 'attack must be non-negative' },
    ),
    ...errorIf(
      typeof stats['defense'] !== 'number' || stats['defense'] < 0,
      { path: 'stats.defense', message: 'defense must be non-negative' },
    ),
  ];
}

function validateLearnedRingSpellIds(learnedRingSpellIds: unknown): ValidationError[] {
  if (!Array.isArray(learnedRingSpellIds)) {
    return [{ path: 'learnedRingSpellIds', message: 'learned ring spell ids must be an array' }];
  }

  return learnedRingSpellIds.flatMap((spellId) =>
    validateContentRef(
        `learnedRingSpellIds.${String(spellId)}`,
        spellId,
        RING_SPELL_BY_ID,
        'RING_SPELL_BY_ID',
        () => 'learned ring spell id must exist in content',
    ).map(error => ({ path: error.field, message: error.message })),
  );
}

function validatePlayerAbilities(abilities: unknown): ValidationError[] {
  if (!Array.isArray(abilities)) {
    return [{ path: 'abilities', message: 'abilities must be an array' }];
  }

  return abilities.flatMap((ability) => {
    if (!isRecord(ability) || typeof ability['id'] !== 'string') {
      return [{ path: 'abilities', message: 'ability entries must be objects with string ids' }];
    }

    const abilityId = ability['id'];
    return [
      ...errorIf(
        !ABILITY_IDS.has(abilityId),
        { path: `abilities.${abilityId}`, message: 'ability id must exist in game-core definitions' },
      ),
      ...errorIf(
        !isFiniteNumber(ability['cooldownRemaining'])
        || ability['cooldownRemaining'] < 0,
        { path: `abilities.${abilityId}.cooldownRemaining`, message: 'ability cooldown must be finite and non-negative' },
      ),
    ];
  });
}

function validateRingMastery(ringMastery: unknown): ValidationError[] {
  if (!isRecord(ringMastery)) {
    return [{ path: 'ringMastery', message: 'ring mastery must be an object' }];
  }

  return Object.entries(ringMastery).flatMap(([school, mastery]) => {
    if (typeof mastery !== 'object' || mastery === null) {
      return [{ path: `ringMastery.${school}`, message: 'ring mastery entries must be exactly { xp: finite non-negative number }' }];
    }

    const masteryRecord = mastery as Record<string, unknown>;
    const keys = Object.keys(masteryRecord);
    return errorIf(
      keys.length !== 1
      || keys[0] !== 'xp'
      || !isFiniteNumber(masteryRecord.xp)
      || masteryRecord.xp < 0,
      { path: `ringMastery.${school}`, message: 'ring mastery entries must be exactly { xp: finite non-negative number }' },
    );
  });
}

function validateInventoryReferences(state: GameState): ValidationError[] {
  return state.player.inventory.flatMap(entityId =>
    errorIf(
      !state.itemRegistry.items.has(entityId),
      { path: `player.inventory.${entityId}`, message: 'inventory item entity id must exist in itemRegistry' },
    ),
  );
}

function validateEquipmentReferences(state: GameState): ValidationError[] {
  return Object.entries(state.player.equipment).flatMap(([slot, entityId]) =>
    errorIf(
      entityId !== null && !state.itemRegistry.items.has(entityId),
      { path: `player.equipment.${slot}`, message: 'equipment item entity id must exist in itemRegistry' },
    ),
  );
}

/**
 * Validate a RunState object
 */
export function validateRunState(run: RunState): ValidationError[] {
  const speedAccumulators = run.speedAccumulators as unknown;

  return [
    ...errorIf(
      typeof run.runId !== 'string' || run.runId === '',
      { path: 'runId', message: 'runId is required and must be non-empty' },
    ),
    ...errorIf(
      typeof run.turnCount !== 'number' || run.turnCount < 0,
      { path: 'turnCount', message: 'turnCount must be non-negative' },
    ),
    ...errorIf(
      typeof run.isActive !== 'boolean',
      { path: 'isActive', message: 'isActive must be boolean' },
    ),
    ...validateRunEnemies(run),
    ...errorIf(
      typeof speedAccumulators !== 'object' || speedAccumulators === null,
      { path: 'speedAccumulators', message: 'speedAccumulators is required and must be an object' },
    ),
  ];
}

function validateRunEnemies(run: RunState): ValidationError[] {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition
  if (run.enemies && typeof run.enemies[Symbol.iterator] === 'function') {
    return Array.from(run.enemies).flatMap(([key, enemy]) => [
      ...prefixErrors(`enemies.${key}`, validateEnemy(enemy)),
      ...validateEnemyPosition(key, enemy, run),
    ]);
  }

  return [{ path: 'enemies', message: 'enemies must be a Map' }];
}

function validateEnemyPosition(
  key: string,
  enemy: EnemyInstance,
  run: RunState,
): ValidationError[] {
  const cell = run.floor.cells.get(posKey(enemy.position));
  if (cell === undefined) {
    return [{
      path: `enemies.${key}.position`,
      message: 'enemy position must reference an existing floor cell',
    }];
  }

  return errorIf(
    cell.tile.walkable !== true,
    {
      path: `enemies.${key}.position`,
      message: 'enemy position must be on a walkable tile',
    },
  );
}

/**
 * Validate an EnemyInstance object
 */
export function validateEnemy(enemy: EnemyInstance): ValidationError[] {
  const position = enemy.position as unknown as { readonly x?: unknown; readonly y?: unknown } | null | undefined;

  return [
    ...errorIf(
      typeof enemy.id !== 'string' || enemy.id === '',
      { path: 'id', message: 'enemy id is required and must be non-empty' },
    ),
    ...errorIf(
      typeof enemy.templateId !== 'string' || enemy.templateId === '',
      { path: 'templateId', message: 'templateId is required and must be non-empty' },
    ),
    ...errorIf(
      typeof enemy.tier !== 'number' || enemy.tier < 0,
      { path: 'tier', message: 'tier must be non-negative' },
    ),
    ...errorIf(
      position === null || position === undefined || typeof position.x !== 'number' || typeof position.y !== 'number',
      { path: 'position', message: 'position is required and must have valid x and y coordinates' },
    ),
    ...errorIf(
      typeof enemy.archetype !== 'string' || enemy.archetype === '',
      { path: 'archetype', message: 'archetype is required and must be non-empty' },
    ),
    ...errorIf(
      typeof enemy.stats.maxHealth !== 'number' || enemy.stats.maxHealth <= 0,
      { path: 'stats.maxHealth', message: 'maxHealth must be positive' },
    ),
    ...errorIf(
      typeof enemy.stats.health !== 'number' || enemy.stats.health < 0,
      { path: 'stats.health', message: 'health must be non-negative' },
    ),
    ...errorIf(
      enemy.stats.health > enemy.stats.maxHealth,
      { path: 'stats.health', message: 'health cannot exceed maxHealth' },
    ),
  ];
}

/**
 * Validate a WorldState object
 */
export function validateWorldState(world: WorldState): ValidationError[] {
  const town = world.town as unknown;

  return [
    ...errorIf(
      typeof town !== 'object' || town === null,
      { path: 'town', message: 'town is required and must be an object' },
    ),
    ...errorIf(
      typeof world.totalRuns !== 'number' || world.totalRuns < 0,
      { path: 'totalRuns', message: 'totalRuns must be non-negative' },
    ),
    ...errorIf(
      typeof world.deepestFloor !== 'number' || world.deepestFloor < 0,
      { path: 'deepestFloor', message: 'deepestFloor must be non-negative' },
    ),
    ...validateFactions(world.factions),
    ...validateDungeonOgre(world),
  ];
}

function validateFactions(factions: WorldState['factions']): ValidationError[] {
  if (!Array.isArray(factions)) {
    return [{ path: 'factions', message: 'factions must be an array' }];
  }

  return factions.flatMap(faction => [
    ...errorIf(
      typeof faction.id !== 'string' || faction.id === '',
      { path: 'factions.id', message: 'each faction must have a non-empty id' },
    ),
    ...errorIf(
      typeof faction.status !== 'string' || !['leaderless', 'led', 'broken'].includes(faction.status),
      { path: 'factions.status', message: 'faction status must be one of: leaderless, led, broken' },
    ),
    ...errorIf(
      typeof faction.power !== 'number' || faction.power < 0 || faction.power > 100,
      { path: 'factions.power', message: 'faction power must be between 0 and 100' },
    ),
    ...errorIf(
      typeof faction.leaderSlain !== 'boolean',
      { path: 'factions.leaderSlain', message: 'faction leaderSlain must be a boolean' },
    ),
  ]);
}

function validateDungeonOgre(world: WorldState): ValidationError[] {
  const dungeonOgre = world.dungeonOgre as unknown as {
    readonly status?: unknown;
    readonly selectedSpawnDepth?: unknown;
  } | null;

  if (typeof dungeonOgre !== 'object' || dungeonOgre === null) {
    return [{ path: 'dungeonOgre', message: 'dungeonOgre is required and must be an object' }];
  }

  return [
    ...errorIf(
      typeof dungeonOgre.status !== 'string' || !['sealed', 'emerged', 'slain'].includes(dungeonOgre.status),
      { path: 'dungeonOgre.status', message: 'dungeonOgre status must be one of: sealed, emerged, slain' },
    ),
    ...errorIf(
      dungeonOgre.status === 'emerged'
      && (typeof dungeonOgre.selectedSpawnDepth !== 'number' || dungeonOgre.selectedSpawnDepth <= 0),
      { path: 'dungeonOgre.selectedSpawnDepth', message: 'dungeonOgre selectedSpawnDepth must be a positive integer when status is emerged' },
    ),
  ];
}

/**
 * Check if a state is valid (convenience wrapper)
 */
export function isGameStateValid(state: GameState): boolean {
  return validateGameState(state).isValid;
}
