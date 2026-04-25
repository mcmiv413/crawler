import type { GameState, RunState, Player, EnemyInstance, WorldState } from '@dungeon/contracts';

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
  if (state.gameId === undefined) {
    mutableErrors.push({ path: 'gameId', message: 'gameId is required' });
  }

  if (state.phase === undefined) {
    mutableErrors.push({ path: 'phase', message: 'phase is required' });
  }

  if (typeof state.version !== 'number' || state.version < 0) {
    mutableErrors.push({ path: 'version', message: 'version must be a non-negative number' });
  }

  if (typeof state.turnNumber !== 'number' || state.turnNumber < 0) {
    mutableErrors.push({ path: 'turnNumber', message: 'turnNumber must be non-negative' });
  }

  if (state.player === undefined) {
    mutableErrors.push({ path: 'player', message: 'player is required' });
  } else {
    mutableErrors.push(...validatePlayer(state.player).map(e => ({ ...e, path: `player.${e.path}` })));
  }

  if (state.world === undefined) {
    mutableErrors.push({ path: 'world', message: 'world is required' });
  } else {
    mutableErrors.push(...validateWorldState(state.world).map(e => ({ ...e, path: `world.${e.path}` })));
  }

  // Validate run if present
  if (state.run !== null && state.run !== undefined) {
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

  if (player.id === undefined) {
    mutableErrors.push({ path: 'id', message: 'player id is required' });
  }

  if (typeof player.level !== 'number' || player.level < 1) {
    mutableErrors.push({ path: 'level', message: 'player level must be at least 1' });
  }

  if (typeof player.experience !== 'number' || player.experience < 0) {
    mutableErrors.push({ path: 'experience', message: 'experience must be non-negative' });
  }

  if (player.stats !== undefined) {
    if (typeof player.stats.maxHealth !== 'number' || player.stats.maxHealth <= 0) {
      mutableErrors.push({ path: 'stats.maxHealth', message: 'maxHealth must be positive' });
    }

    if (typeof player.stats.health !== 'number' || player.stats.health < 0) {
      mutableErrors.push({ path: 'stats.health', message: 'health must be non-negative' });
    }

    if (player.stats.health > player.stats.maxHealth) {
      mutableErrors.push({ path: 'stats.health', message: 'health cannot exceed maxHealth' });
    }

    if (typeof player.stats.attack !== 'number' || player.stats.attack < 0) {
      mutableErrors.push({ path: 'stats.attack', message: 'attack must be non-negative' });
    }

    if (typeof player.stats.defense !== 'number' || player.stats.defense < 0) {
      mutableErrors.push({ path: 'stats.defense', message: 'defense must be non-negative' });
    }
  }

  if (player.position === undefined) {
    mutableErrors.push({ path: 'position', message: 'position is required' });
  }

  if (typeof player.gold !== 'number' || player.gold < 0) {
    mutableErrors.push({ path: 'gold', message: 'gold must be non-negative' });
  }

  return mutableErrors;
}

/**
 * Validate a RunState object
 */
export function validateRunState(run: RunState): ValidationError[] {
  const mutableErrors: ValidationError[] = [];

  if (run.runId === undefined) {
    mutableErrors.push({ path: 'runId', message: 'runId is required' });
  }

  if (typeof run.turnCount !== 'number' || run.turnCount < 0) {
    mutableErrors.push({ path: 'turnCount', message: 'turnCount must be non-negative' });
  }

  if (typeof run.isActive !== 'boolean') {
    mutableErrors.push({ path: 'isActive', message: 'isActive must be boolean' });
  }

  if (run.floor === undefined) {
    mutableErrors.push({ path: 'floor', message: 'floor is required' });
  }

  if (run.enemies === undefined) {
    mutableErrors.push({ path: 'enemies', message: 'enemies is required' });
  } else {
    for (const [key, enemy] of run.enemies) {
      if (key === undefined || enemy === undefined) {
        mutableErrors.push({ path: `enemies.${key}`, message: 'invalid enemy entry' });
      } else {
        mutableErrors.push(...validateEnemy(enemy).map(e => ({ ...e, path: `enemies.${key}.${e.path}` })));
      }
    }
  }

  if (run.speedAccumulators === undefined || typeof run.speedAccumulators !== 'object') {
    mutableErrors.push({ path: 'speedAccumulators', message: 'speedAccumulators is required and must be an object' });
  }

  return mutableErrors;
}

/**
 * Validate an EnemyInstance object
 */
export function validateEnemy(enemy: EnemyInstance): ValidationError[] {
  const mutableErrors: ValidationError[] = [];

  if (enemy.id === undefined) {
    mutableErrors.push({ path: 'id', message: 'enemy id is required' });
  }

  if (enemy.templateId === undefined) {
    mutableErrors.push({ path: 'templateId', message: 'templateId is required' });
  }

  if (typeof enemy.tier !== 'number' || enemy.tier < 0) {
    mutableErrors.push({ path: 'tier', message: 'tier must be non-negative' });
  }

  if (enemy.stats !== undefined) {
    if (typeof enemy.stats.maxHealth !== 'number' || enemy.stats.maxHealth <= 0) {
      mutableErrors.push({ path: 'stats.maxHealth', message: 'maxHealth must be positive' });
    }

    if (typeof enemy.stats.health !== 'number' || enemy.stats.health < 0) {
      mutableErrors.push({ path: 'stats.health', message: 'health must be non-negative' });
    }

    if (enemy.stats.health > enemy.stats.maxHealth) {
      mutableErrors.push({ path: 'stats.health', message: 'health cannot exceed maxHealth' });
    }
  }

  if (enemy.position === undefined) {
    mutableErrors.push({ path: 'position', message: 'position is required' });
  }

  if (enemy.archetype === undefined) {
    mutableErrors.push({ path: 'archetype', message: 'archetype is required' });
  }

  return mutableErrors;
}

/**
 * Validate a WorldState object
 */
export function validateWorldState(world: WorldState): ValidationError[] {
  const mutableErrors: ValidationError[] = [];

  if (world.town === undefined) {
    mutableErrors.push({ path: 'town', message: 'town is required' });
  }

  if (typeof world.totalRuns !== 'number' || world.totalRuns < 0) {
    mutableErrors.push({ path: 'totalRuns', message: 'totalRuns must be non-negative' });
  }

  if (typeof world.deepestFloor !== 'number' || world.deepestFloor < 0) {
    mutableErrors.push({ path: 'deepestFloor', message: 'deepestFloor must be non-negative' });
  }

  if (!Array.isArray(world.nemeses)) {
    mutableErrors.push({ path: 'nemeses', message: 'nemeses must be an array' });
  }

  if (!Array.isArray(world.factions)) {
    mutableErrors.push({ path: 'factions', message: 'factions must be an array' });
  }

  return mutableErrors;
}

/**
 * Check if a state is valid (convenience wrapper)
 */
export function isGameStateValid(state: GameState): boolean {
  return validateGameState(state).isValid;
}
