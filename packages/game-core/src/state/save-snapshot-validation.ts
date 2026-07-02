import type {
  GamePhase,
  Player,
  SaveSnapshot,
  SaveSnapshotValidationError,
  SaveSnapshotValidationResult,
} from '@dungeon/contracts';
import {
  posKey,
  SAVE_SNAPSHOT_SCHEMA_VERSION,
} from '@dungeon/contracts';
import {
  ENEMY_TEMPLATES,
  ITEM_BY_ID,
  OBJECT_TEMPLATES,
  RING_SCHOOL_BY_ID,
} from '@dungeon/content';
import { validatePlayer as validateCorePlayer } from './validators.js';

const VALID_PHASES = new Set<GamePhase>(['town', 'dungeon', 'combat', 'game_over']);
const REQUIRED_WEAPON_MASTERY_KEYS = ['blade', 'bludgeon', 'axe', 'ranged', 'dagger'] as const;

export class SaveSnapshotLoadError extends Error {
  readonly validationErrors: readonly SaveSnapshotValidationError[];

  constructor(errors: readonly SaveSnapshotValidationError[]);
  constructor(message: string, errors: readonly SaveSnapshotValidationError[]);
  constructor(
    messageOrErrors: string | readonly SaveSnapshotValidationError[],
    maybeErrors?: readonly SaveSnapshotValidationError[],
  ) {
    const message = typeof messageOrErrors === 'string' ? messageOrErrors : 'Invalid save snapshot';
    const errors = typeof messageOrErrors === 'string' ? maybeErrors ?? [] : messageOrErrors;
    const details = errors.map(error => `${error.field}: ${error.message}`).join('\n');
    super(`${message}:\n${details}`);
    this.name = 'SaveSnapshotLoadError';
    this.validationErrors = errors;
  }
}

export function validateSaveSnapshot(snapshot: unknown): SaveSnapshotValidationResult {
  if (!isRecord(snapshot)) {
    return {
      isValid: false,
      errors: [{ field: 'snapshot', message: 'snapshot must be an object' }],
    };
  }

  const errors: SaveSnapshotValidationError[] = [
    ...validateRequiredRoots(snapshot),
    ...validateSchemaVersionField(snapshot),
    ...validateMetadata(snapshot['metadata']),
    ...validatePrimitiveFields(snapshot),
    ...validateItemRegistry(snapshot['itemRegistry']),
    ...validateSnapshotPlayer(snapshot['player'], snapshot['itemRegistry']),
    ...validateWorld(snapshot['world']),
    ...validateRunAndFloor(snapshot),
    ...validateObjects(snapshot['objects'], snapshot['floor']),
    ...validatePersistedFloorCache(snapshot['persistedFloorCache']),
  ];

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function migrateSaveSnapshot(snapshot: unknown): SaveSnapshot {
  if (!isRecord(snapshot)) {
    throw new SaveSnapshotLoadError([{ field: 'snapshot', message: 'snapshot must be an object' }]);
  }

  // Guard against unsupported schema versions: unknown or future versions must fail
  // cleanly rather than be silently cast to SaveSnapshot.
  if (snapshot['schemaVersion'] !== SAVE_SNAPSHOT_SCHEMA_VERSION) {
    throw new SaveSnapshotLoadError([{
      field: 'schemaVersion',
      message: `Unsupported save snapshot schemaVersion ${String(snapshot['schemaVersion'])}. Expected ${SAVE_SNAPSHOT_SCHEMA_VERSION}.`,
    }]);
  }

  // Version 1 has no migrations; this is a no-op pass-through today.
  // Future versions should add explicit per-version migration steps here.
  // loadSaveSnapshot must validate the migrated/current snapshot before restore.
  return snapshot as unknown as SaveSnapshot;
}

function validateRequiredRoots(
  snapshot: Record<string, unknown>,
): SaveSnapshotValidationError[] {
  return [
    'schemaVersion',
    'metadata',
    'player',
    'world',
    'run',
    'floor',
    'enemies',
    'objects',
    'itemRegistry',
    'seed',
    'turnNumber',
  ].flatMap(field =>
    Object.prototype.hasOwnProperty.call(snapshot, field)
      ? []
      : [{ field, message: `${field} is required` }],
  );
}

function validateSchemaVersionField(
  snapshot: Record<string, unknown>,
): SaveSnapshotValidationError[] {
  if (snapshot['schemaVersion'] !== SAVE_SNAPSHOT_SCHEMA_VERSION) {
    return [{
      field: 'schemaVersion',
      message: `Unsupported save snapshot schemaVersion ${String(snapshot['schemaVersion'])}. Expected ${SAVE_SNAPSHOT_SCHEMA_VERSION}.`,
    }];
  }
  return [];
}

function validateMetadata(
  metadata: unknown,
): SaveSnapshotValidationError[] {
  if (!isRecord(metadata)) {
    return [{ field: 'metadata', message: 'metadata must be an object' }];
  }

  return [
    ...pushFiniteNumberError(metadata['saveTimestamp'], 'metadata.saveTimestamp'),
    ...pushPositiveIntegerError(metadata['characterLevel'], 'metadata.characterLevel'),
    ...pushFiniteNumberError(metadata['currentFloor'], 'metadata.currentFloor'),
    ...(metadata['displayName'] !== undefined && typeof metadata['displayName'] !== 'string'
      ? [{ field: 'metadata.displayName', message: 'displayName must be a string when present' }]
      : []),
  ];
}

function validatePrimitiveFields(
  snapshot: Record<string, unknown>,
): SaveSnapshotValidationError[] {
  return [
    ...(typeof snapshot['gameId'] !== 'string' || snapshot['gameId'].length === 0
      ? [{ field: 'gameId', message: 'gameId must be a non-empty string' }]
      : []),
    ...(typeof snapshot['phase'] !== 'string' || !VALID_PHASES.has(snapshot['phase'] as GamePhase)
      ? [{ field: 'phase', message: 'phase must be a known game phase' }]
      : []),
    ...pushFiniteNumberError(snapshot['seed'], 'seed'),
    ...pushFiniteNumberError(snapshot['turnNumber'], 'turnNumber'),
    ...pushFiniteNumberError(snapshot['version'], 'version'),
    ...(!Array.isArray(snapshot['activeQuests'])
      ? [{ field: 'activeQuests', message: 'activeQuests must be an array' }]
      : []),
    ...validateWeaponMastery(snapshot['weaponMastery']),
  ];
}
function validateWeaponMastery(
  weaponMastery: unknown,
): SaveSnapshotValidationError[] {
  if (!isRecord(weaponMastery)) {
    return [{ field: 'weaponMastery', message: 'weaponMastery must be an object' }];
  }

  return REQUIRED_WEAPON_MASTERY_KEYS.flatMap(key => {
    const value = weaponMastery[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      const field = `weaponMastery.${key}`;
      return [{ field, message: `${field} must be a finite non-negative number` }];
    }
    return [];
  });
}

function validateItemRegistry(
  itemRegistry: unknown,
): SaveSnapshotValidationError[] {
  if (!isRecord(itemRegistry) || !isRecord(itemRegistry['items'])) {
    return [{ field: 'itemRegistry.items', message: 'itemRegistry.items must be an object' }];
  }

  return Object.entries(itemRegistry['items']).flatMap(([entityId, item]) => {
    if (!isRecord(item)) {
      return [{ field: `itemRegistry.items.${entityId}`, message: 'registered item must be an object' }];
    }

    const itemId = item['itemId'];
    if (typeof itemId !== 'string' || !ITEM_BY_ID.has(itemId)) {
      return [{
        field: `itemRegistry.items.${entityId}.itemId`,
        message: `registered item id ${String(itemId)} must exist in ITEM_BY_ID`,
      }];
    }
    return [];
  });
}

function validateSnapshotPlayer(
  player: unknown,
  itemRegistry: unknown,
): SaveSnapshotValidationError[] {
  if (!isRecord(player)) {
    return [{ field: 'player', message: 'player must be an object' }];
  }

  const registryItemMap = getRegistryItemMap(itemRegistry);

  const coreErrors: SaveSnapshotValidationError[] = validateCorePlayer(player as unknown as Player)
    .map(error => ({ field: `player.${error.path}`, message: error.message }));

  const inventoryErrors: SaveSnapshotValidationError[] = Array.isArray(player['inventory'])
    ? (player['inventory'] as unknown[]).flatMap((itemEntityId, index) =>
        typeof itemEntityId !== 'string' || !registryItemMap.has(itemEntityId)
          ? [{ field: `player.inventory[${index}]`, message: `player.inventory[${index}] references unknown item entity id ${String(itemEntityId)}` }]
          : [],
      )
    : [{ field: 'player.inventory', message: 'player.inventory must be an array' }];

  const equipmentErrors: SaveSnapshotValidationError[] = isRecord(player['equipment'])
    ? Object.entries(player['equipment']).flatMap(([slot, itemEntityId]) => {
        if (itemEntityId !== null && (typeof itemEntityId !== 'string' || !registryItemMap.has(itemEntityId))) {
          return [{ field: `player.equipment.${slot}`, message: 'equipment item entity id must exist in itemRegistry' }];
        }
        if (typeof itemEntityId === 'string') {
          const item = registryItemMap.get(itemEntityId);
          if (item !== undefined) {
            return validateEquipmentSlotCompatibility(slot, itemEntityId, item);
          }
        }
        return [];
      })
    : [{ field: 'player.equipment', message: 'player.equipment must be an object' }];

  return [
    ...coreErrors,
    ...pushFiniteNumberError(player['floor'], 'player.floor'),
    ...inventoryErrors,
    ...equipmentErrors,
    ...validateKnownRingSchools(player),
  ];
}


function validateEquipmentSlotCompatibility(
  slot: string,
  itemEntityId: string,
  item: Record<string, unknown>,
): SaveSnapshotValidationError[] {
  if (slot === 'weapon' || slot === 'secondaryWeapon') {
    if (item['itemClass'] !== 'weapon') {
      return [{
        field: `player.equipment.${slot}`,
        message: `item "${itemEntityId}" is not a valid weapon (got ${describeItemKind(item)})`,
      }];
    }
    return [];
  }

  const expectedArmorSlot = getExpectedArmorSlot(slot);
  if (expectedArmorSlot === null) {
    return [];
  }

  const armor = item['armor'];
  if (item['itemClass'] !== 'armor' || !isRecord(armor) || armor['slot'] !== expectedArmorSlot) {
    return [{
      field: `player.equipment.${slot}`,
      message: `item "${itemEntityId}" is not valid for ${slot} slot (got ${describeItemKind(item)})`,
    }];
  }
  return [];
}

function getExpectedArmorSlot(slot: string): string | null {
  if (slot === 'ring1' || slot === 'ring2') return 'ring';
  if (slot === 'chest' || slot === 'head' || slot === 'gloves' || slot === 'boots') return slot;
  return null;
}

function describeItemKind(item: Record<string, unknown>): string {
  const itemClass = item['itemClass'];
  if (itemClass === 'armor') {
    const armor = item['armor'];
    if (isRecord(armor) && typeof armor['slot'] === 'string' && armor['slot'].length > 0) {
      return `armor:${armor['slot']}`;
    }
    return 'armor';
  }

  return typeof itemClass === 'string' && itemClass.length > 0 ? itemClass : 'unknown';
}

function validateKnownRingSchools(
  player: Record<string, unknown>,
): SaveSnapshotValidationError[] {
  const knownSchoolErrors: SaveSnapshotValidationError[] = Array.isArray(player['knownRingSchools'])
    ? (player['knownRingSchools'] as unknown[]).flatMap((school, index) =>
        typeof school !== 'string' || !RING_SCHOOL_BY_ID.has(school)
          ? [{ field: `player.knownRingSchools[${index}]`, message: `player.knownRingSchools[${index}] references unknown ring school ${String(school)}` }]
          : [],
      )
    : player['knownRingSchools'] !== undefined
      ? [{ field: 'player.knownRingSchools', message: 'player.knownRingSchools must be an array' }]
      : [];

  const ringMasteryErrors: SaveSnapshotValidationError[] = isRecord(player['ringMastery'])
    ? Object.keys(player['ringMastery']).flatMap(school =>
        !RING_SCHOOL_BY_ID.has(school)
          ? [{ field: `player.ringMastery.${school}`, message: 'ring mastery school must exist in content' }]
          : [],
      )
    : [];

  return [...knownSchoolErrors, ...ringMasteryErrors];
}

function validateWorld(
  world: unknown,
): SaveSnapshotValidationError[] {
  if (!isRecord(world)) {
    return [{ field: 'world', message: 'world must be an object' }];
  }

  return [
    ...(!isRecord(world['town'])
      ? [{ field: 'world.town', message: 'world.town must be an object' }]
      : []),
    ...(!Array.isArray(world['factions'])
      ? [{ field: 'world.factions', message: 'world.factions must be an array' }]
      : []),
    ...(!isRecord(world['dungeonOgre'])
      ? [{ field: 'world.dungeonOgre', message: 'world.dungeonOgre must be an object' }]
      : []),
  ];
}

function validateRunAndFloor(
  snapshot: Record<string, unknown>,
): SaveSnapshotValidationError[] {
  const run = snapshot['run'];
  const floor = snapshot['floor'];
  const enemies = snapshot['enemies'];

  if (run !== null && !isRecord(run)) {
    return [{ field: 'run', message: 'run must be an object or null' }];
  }

  if (run === null) {
    return [
      ...(floor !== null ? [{ field: 'floor', message: 'floor must be null when run is null' }] : []),
      ...(!isRecord(enemies)
        ? [{ field: 'enemies', message: 'enemies must be an object' }]
        : Object.keys(enemies).length > 0
          ? [{ field: 'enemies', message: 'enemies must be empty when run is null' }]
          : []),
    ];
  }

  const speedAccumulatorErrors: SaveSnapshotValidationError[] = isRecord(run['speedAccumulators'])
    ? Object.entries(run['speedAccumulators']).flatMap(([key, value]) => {
        const field = `run.speedAccumulators[${key}]`;
        return typeof value !== 'number' || !Number.isFinite(value)
          ? [{ field, message: `${field} must be a finite number` }]
          : [];
      })
    : [{ field: 'run.speedAccumulators', message: 'speedAccumulators must be an object' }];

  const runErrors: SaveSnapshotValidationError[] = [
    ...pushFiniteNumberError(run['turnCount'], 'run.turnCount'),
    ...(typeof run['runId'] !== 'string' || run['runId'].length === 0
      ? [{ field: 'run.runId', message: 'runId must be a non-empty string' }]
      : []),
    ...(typeof run['isActive'] !== 'boolean'
      ? [{ field: 'run.isActive', message: 'run.isActive must be a boolean' }]
      : []),
    ...speedAccumulatorErrors,
  ];

  if (!isRecord(floor)) {
    return [
      ...runErrors,
      { field: 'floor', message: 'floor must be an object for active runs' },
      ...validateEnemies(enemies, { cells: {} }, snapshot['player']),
    ];
  }

  return [
    ...runErrors,
    ...validateFloor(floor, 'floor'),
    ...validateEnemies(enemies, floor, snapshot['player']),
  ];
}

function validateFloor(
  floor: Record<string, unknown>,
  fieldPrefix: string,
): SaveSnapshotValidationError[] {
  return [
    ...pushPositiveIntegerError(floor['width'], `${fieldPrefix}.width`),
    ...pushPositiveIntegerError(floor['height'], `${fieldPrefix}.height`),
    ...pushPositiveIntegerError(floor['depth'], `${fieldPrefix}.depth`),
    ...pushFiniteNumberError(floor['seed'], `${fieldPrefix}.seed`),
    ...(typeof floor['biomeId'] !== 'string' || floor['biomeId'].length === 0
      ? [{ field: `${fieldPrefix}.biomeId`, message: 'biomeId must be a non-empty string' }]
      : []),
    ...(!isRecord(floor['cells']) || Object.keys(floor['cells']).length === 0
      ? [{ field: `${fieldPrefix}.cells`, message: 'floor cells must be a non-empty object' }]
      : []),
    ...(!isPosition(floor['entrance'])
      ? [{ field: `${fieldPrefix}.entrance`, message: 'entrance must be a position' }]
      : []),
    ...(!isPosition(floor['exit'])
      ? [{ field: `${fieldPrefix}.exit`, message: 'exit must be a position' }]
      : []),
  ];
}

function validateEnemies(
  enemies: unknown,
  floor: Record<string, unknown>,
  player: unknown,
): SaveSnapshotValidationError[] {
  if (!isRecord(enemies)) {
    return [{ field: 'enemies', message: 'enemies must be an object' }];
  }

  const cells = isRecord(floor['cells']) ? floor['cells'] : {};
  const playerPosErrors: SaveSnapshotValidationError[] =
    isRecord(player) && isPosition(player['position']) && !Object.prototype.hasOwnProperty.call(cells, posKey(player['position']))
      ? [{ field: 'floor.cells', message: 'floor cells must include player position' }]
      : [];

  return [
    ...playerPosErrors,
    ...Object.entries(enemies).flatMap(([key, enemy]) => validateEnemy(key, enemy, cells)),
  ];
}

function validateEnemy(
  key: string,
  enemy: unknown,
  cells: Record<string, unknown>,
): SaveSnapshotValidationError[] {
  if (!isRecord(enemy)) {
    return [{ field: `enemies[${key}]`, message: 'enemy must be an object' }];
  }

  const templateId = enemy['templateId'];
  const templateErrors: SaveSnapshotValidationError[] = typeof templateId !== 'string' || !ENEMY_TEMPLATES.has(templateId)
    ? [{ field: `enemies[${key}].templateId`, message: `enemy template id ${String(templateId)} must exist in ENEMY_TEMPLATES` }]
    : [];

  if (!isPosition(enemy['position'])) {
    return [...templateErrors, { field: `enemies[${key}].position`, message: 'enemy position must be a position' }];
  }

  const expectedKey = posKey(enemy['position']);
  return [
    ...templateErrors,
    ...(expectedKey !== key
      ? [{ field: `enemies[${key}].position`, message: `enemy map key must match enemy position ${expectedKey}` }]
      : []),
    ...(!Object.prototype.hasOwnProperty.call(cells, expectedKey)
      ? [{ field: `enemies[${key}].position`, message: 'enemy position must reference an existing floor cell' }]
      : []),
  ];
}

function validateObjects(objects: unknown, floor: unknown): SaveSnapshotValidationError[] {
  if (!isRecord(objects)) {
    return [{ field: 'objects', message: 'objects must be an object' }];
  }
  const cells = isRecord(floor) && isRecord(floor['cells']) ? floor['cells'] : {};
  return Object.entries(objects).flatMap(([key, object]): SaveSnapshotValidationError[] => {
    if (!isRecord(object)) {
      return [{ field: `objects[${key}]`, message: 'object must be an object' }];
    }
    const templateId = object['templateId'];
    const templateErrors: SaveSnapshotValidationError[] = typeof templateId !== 'string' || !OBJECT_TEMPLATES.has(templateId)
      ? [{ field: `objects[${key}].templateId`, message: `object template id ${String(templateId)} must exist in OBJECT_TEMPLATES` }]
      : [];

    const positionMatchErrors: SaveSnapshotValidationError[] = isPosition(object['position'])
      ? posKey(object['position']) !== key
        ? [{ field: `objects[${key}].position`, message: `object map key must match object position ${posKey(object['position'])}` }]
        : !Object.prototype.hasOwnProperty.call(cells, key)
          ? [{ field: `objects[${key}].position`, message: 'object position must reference an existing floor cell' }]
          : []
      : [];

    const exhaustedErrors: SaveSnapshotValidationError[] = typeof object['isExhausted'] !== 'boolean'
      ? [{ field: `objects[${key}].isExhausted`, message: `objects[${key}].isExhausted must be a boolean` }]
      : [];

    return [
      ...templateErrors,
      ...validateObjectPosition(key, object['position']),
      ...positionMatchErrors,
      ...exhaustedErrors,
    ];
  });
}

function validateObjectPosition(
  key: string,
  position: unknown,
): SaveSnapshotValidationError[] {
  const positionRecord = isRecord(position) ? position : null;
  return (['x', 'y'] as const).flatMap(axis => {
    const value = positionRecord?.[axis];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      const field = `objects[${key}].position.${axis}`;
      return [{ field, message: `${field} must be a finite number` }];
    }
    return [];
  });
}

function validatePersistedFloorCache(
  persistedFloorCache: unknown,
): SaveSnapshotValidationError[] {
  if (persistedFloorCache === undefined) {
    return [];
  }
  if (!isRecord(persistedFloorCache)) {
    return [{ field: 'persistedFloorCache', message: 'persistedFloorCache must be an object when present' }];
  }

  const seenDepths = new Set<number>();
  return Object.entries(persistedFloorCache).flatMap(([depth, storedFloor]): SaveSnapshotValidationError[] => {
    const depthNum = Number(depth);
    if (!Number.isInteger(depthNum) || depthNum < 1) {
      return [{ field: 'persistedFloorCache', message: `depth key "${depth}" must be a positive integer` }];
    }
    if (seenDepths.has(depthNum)) {
      return [{ field: 'persistedFloorCache', message: `duplicate normalized depth key ${depthNum} (from "${depth}")` }];
    }
    seenDepths.add(depthNum);
    if (!isRecord(storedFloor)) {
      return [{ field: `persistedFloorCache[${depth}]`, message: 'stored floor must be an object' }];
    }
    if (!isRecord(storedFloor['floor'])) {
      return [{ field: `persistedFloorCache[${depth}].floor`, message: 'stored floor must include floor data' }];
    }
    const floorData = storedFloor['floor'] as Record<string, unknown>;
    return [
      ...validateFloor(storedFloor['floor'], `persistedFloorCache[${depth}].floor`),
      ...(typeof floorData['depth'] === 'number' && floorData['depth'] !== depthNum
        ? [{ field: `persistedFloorCache[${depth}].floor.depth`, message: `floor.depth ${floorData['depth']} does not match cache key ${depthNum}` }]
        : []),
      ...(isRecord(storedFloor['enemies'])
        ? validateEnemies(storedFloor['enemies'], floorData, null)
            .map(e => ({ ...e, field: `persistedFloorCache[${depth}].${e.field}` }))
        : [{ field: `persistedFloorCache[${depth}].enemies`, message: 'stored floor enemies must be an object' }]),
      ...(isRecord(storedFloor['objects'])
        ? validateObjects(storedFloor['objects'], storedFloor['floor'])
            .map(e => ({ ...e, field: `persistedFloorCache[${depth}].${e.field}` }))
        : [{ field: `persistedFloorCache[${depth}].objects`, message: 'stored floor objects must be an object' }]),
      ...(!isPosition(storedFloor['playerPosition'])
        ? [{ field: `persistedFloorCache[${depth}].playerPosition`, message: 'stored floor playerPosition must be a valid position' }]
        : []),
      ...(isPosition(storedFloor['playerPosition']) && isRecord(floorData['cells']) && !(`${storedFloor['playerPosition'].x},${storedFloor['playerPosition'].y}` in floorData['cells'])
        ? [{ field: `persistedFloorCache[${depth}].playerPosition`, message: `playerPosition (${storedFloor['playerPosition'].x},${storedFloor['playerPosition'].y}) does not reference an existing floor cell` }]
        : []),
      ...(storedFloor['originalEnemyCount'] !== undefined &&
        (typeof storedFloor['originalEnemyCount'] !== 'number' ||
          !Number.isInteger(storedFloor['originalEnemyCount']) ||
          storedFloor['originalEnemyCount'] < 0)
        ? [{ field: `persistedFloorCache[${depth}].originalEnemyCount`, message: 'originalEnemyCount must be a non-negative integer when present' }]
        : []),
      ...(storedFloor['lastSimulatedTurn'] !== undefined &&
        (typeof storedFloor['lastSimulatedTurn'] !== 'number' ||
          !Number.isInteger(storedFloor['lastSimulatedTurn']) ||
          storedFloor['lastSimulatedTurn'] < 0)
        ? [{ field: `persistedFloorCache[${depth}].lastSimulatedTurn`, message: 'lastSimulatedTurn must be a non-negative integer when present' }]
        : []),
    ];
  });
}

function getRegistryItemMap(itemRegistry: unknown): Map<string, Record<string, unknown>> {
  const items = new Map<string, Record<string, unknown>>();
  if (!isRecord(itemRegistry) || !isRecord(itemRegistry['items'])) {
    return items;
  }

  for (const [entityId, item] of Object.entries(itemRegistry['items'])) {
    if (isRecord(item)) {
      items.set(entityId, item);
    }
  }
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is { readonly x: number; readonly y: number } {
  return isRecord(value)
    && typeof value['x'] === 'number'
    && Number.isFinite(value['x'])
    && typeof value['y'] === 'number'
    && Number.isFinite(value['y']);
}

function pushFiniteNumberError(
  value: unknown,
  field: string,
): SaveSnapshotValidationError[] {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return [{ field, message: `${field} must be a finite number` }];
  }
  return [];
}

function pushPositiveIntegerError(
  value: unknown,
  field: string,
): SaveSnapshotValidationError[] {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return [{ field, message: `${field} must be an integer >= 1` }];
  }
  return [];
}
