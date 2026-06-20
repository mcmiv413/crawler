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
  RING_SPELL_BY_ID,
  RING_SCHOOL_BY_ID,
} from '@dungeon/content';
import { validatePlayer as validateCorePlayer } from './validators.js';

const VALID_PHASES = new Set<GamePhase>(['town', 'dungeon', 'combat', 'game_over']);
const REQUIRED_WEAPON_MASTERY_KEYS = ['blade', 'bludgeon', 'axe', 'ranged', 'dagger'] as const;

export class SaveSnapshotLoadError extends Error {
  readonly validationErrors: readonly SaveSnapshotValidationError[];

  constructor(mutableErrors: readonly SaveSnapshotValidationError[]) {
    const details = mutableErrors.map(error => `${error.field}: ${error.message}`).join('\n');
    super(`Invalid save snapshot:\n${details}`);
    this.name = 'SaveSnapshotLoadError';
    this.validationErrors = mutableErrors;
  }
}

export function validateSaveSnapshot(snapshot: unknown): SaveSnapshotValidationResult {
  const mutableErrors: SaveSnapshotValidationError[] = [];
  if (!isRecord(snapshot)) {
    return {
      isValid: false,
      errors: [{ field: 'snapshot', message: 'snapshot must be an object' }],
    };
  }

  validateRequiredRoots(snapshot, mutableErrors);
  validateSchemaVersionField(snapshot, mutableErrors);
  validateMetadata(snapshot['metadata'], mutableErrors);
  validatePrimitiveFields(snapshot, mutableErrors);
  validateItemRegistry(snapshot['itemRegistry'], mutableErrors);
  validateSnapshotPlayer(snapshot['player'], snapshot['itemRegistry'], mutableErrors);
  validateWorld(snapshot['world'], mutableErrors);
  validateRunAndFloor(snapshot, mutableErrors);
  validateObjects(snapshot['objects'], snapshot['floor'], mutableErrors);
  validatePersistedFloorCache(snapshot['persistedFloorCache'], mutableErrors);

  return {
    isValid: mutableErrors.length === 0,
    errors: mutableErrors,
  };
}

export function migrateSaveSnapshot(snapshot: unknown): SaveSnapshot {
  if (!isRecord(snapshot)) {
    throw new SaveSnapshotLoadError([{ field: 'snapshot', message: 'snapshot must be an object' }]);
  }

  // Version 1 has no migrations; this is a no-op pass-through today.
  // Future versions should add explicit per-version migration steps here.
  // loadSaveSnapshot must validate the migrated/current snapshot before restore.
  // Unsupported future versions must fail cleanly rather than pass through.
  return snapshot as unknown as SaveSnapshot;
}

function validateRequiredRoots(
  snapshot: Record<string, unknown>,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  for (const field of [
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
  ]) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, field)) {
      mutableErrors.push({ field, message: `${field} is required` });
    }
  }
}

function validateSchemaVersionField(
  snapshot: Record<string, unknown>,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (snapshot['schemaVersion'] !== SAVE_SNAPSHOT_SCHEMA_VERSION) {
    mutableErrors.push({
      field: 'schemaVersion',
      message: `Unsupported save snapshot schemaVersion ${String(snapshot['schemaVersion'])}. Expected ${SAVE_SNAPSHOT_SCHEMA_VERSION}.`,
    });
  }
}

function validateMetadata(
  metadata: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (!isRecord(metadata)) {
    mutableErrors.push({ field: 'metadata', message: 'metadata must be an object' });
    return;
  }

  pushFiniteNumberError(metadata['saveTimestamp'], 'metadata.saveTimestamp', mutableErrors);
  pushPositiveIntegerError(metadata['characterLevel'], 'metadata.characterLevel', mutableErrors);
  pushFiniteNumberError(metadata['currentFloor'], 'metadata.currentFloor', mutableErrors);
  if (
    metadata['displayName'] !== undefined
    && typeof metadata['displayName'] !== 'string'
  ) {
    mutableErrors.push({ field: 'metadata.displayName', message: 'displayName must be a string when present' });
  }
}

function validatePrimitiveFields(
  snapshot: Record<string, unknown>,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (typeof snapshot['gameId'] !== 'string' || snapshot['gameId'].length === 0) {
    mutableErrors.push({ field: 'gameId', message: 'gameId must be a non-empty string' });
  }
  if (typeof snapshot['phase'] !== 'string' || !VALID_PHASES.has(snapshot['phase'] as GamePhase)) {
    mutableErrors.push({ field: 'phase', message: 'phase must be a known game phase' });
  }
  pushFiniteNumberError(snapshot['seed'], 'seed', mutableErrors);
  pushFiniteNumberError(snapshot['turnNumber'], 'turnNumber', mutableErrors);
  pushFiniteNumberError(snapshot['version'], 'version', mutableErrors);
  if (!Array.isArray(snapshot['activeQuests'])) {
    mutableErrors.push({ field: 'activeQuests', message: 'activeQuests must be an array' });
  }
  validateWeaponMastery(snapshot['weaponMastery'], mutableErrors);
}
function validateWeaponMastery(
  weaponMastery: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (!isRecord(weaponMastery)) {
    mutableErrors.push({ field: 'weaponMastery', message: 'weaponMastery must be an object' });
    return;
  }

  for (const key of REQUIRED_WEAPON_MASTERY_KEYS) {
    const value = weaponMastery[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      const field = `weaponMastery.${key}`;
      mutableErrors.push({ field, message: `${field} must be a finite non-negative number` });
    }
  }
}

function validateItemRegistry(
  itemRegistry: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (!isRecord(itemRegistry) || !isRecord(itemRegistry['items'])) {
    mutableErrors.push({ field: 'itemRegistry.items', message: 'itemRegistry.items must be an object' });
    return;
  }

  for (const [entityId, item] of Object.entries(itemRegistry['items'])) {
    if (!isRecord(item)) {
      mutableErrors.push({ field: `itemRegistry.items.${entityId}`, message: 'registered item must be an object' });
      continue;
    }

    const itemId = item['itemId'];
    if (typeof itemId !== 'string' || !ITEM_BY_ID.has(itemId)) {
      mutableErrors.push({
        field: `itemRegistry.items.${entityId}.itemId`,
        message: `registered item id ${String(itemId)} must exist in ITEM_BY_ID`,
      });
    }
  }
}

function validateSnapshotPlayer(
  player: unknown,
  itemRegistry: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (!isRecord(player)) {
    mutableErrors.push({ field: 'player', message: 'player must be an object' });
    return;
  }

  const registryItems = getRegistryItems(itemRegistry);
  const registryItemRecords = getRegistryItemRecords(itemRegistry);
  for (const error of validateCorePlayer(player as unknown as Player)) {
    mutableErrors.push({ field: `player.${error.path}`, message: error.message });
  }
  pushFiniteNumberError(player['floor'], 'player.floor', mutableErrors);
  validateLearnedRingSpellIds(player['learnedRingSpellIds'], mutableErrors);

  const inventory = player['inventory'];
  if (Array.isArray(inventory)) {
    for (const [index, itemEntityId] of inventory.entries()) {
      if (typeof itemEntityId !== 'string' || !registryItems.has(itemEntityId)) {
        const field = `player.inventory[${index}]`;
        mutableErrors.push({ field, message: `${field} references unknown item entity id ${String(itemEntityId)}` });
      }
    }
  } else {
    mutableErrors.push({ field: 'player.inventory', message: 'player.inventory must be an array' });
  }

  if (isRecord(player['equipment'])) {
    for (const [slot, itemEntityId] of Object.entries(player['equipment'])) {
      if (itemEntityId !== null && (typeof itemEntityId !== 'string' || !registryItems.has(itemEntityId))) {
        mutableErrors.push({
          field: `player.equipment.${slot}`,
          message: 'equipment item entity id must exist in itemRegistry',
        });
        continue;
      }

      if (typeof itemEntityId === 'string') {
        const item = registryItemRecords.get(itemEntityId);
        if (item !== undefined) {
          validateEquipmentSlotCompatibility(slot, itemEntityId, item, mutableErrors);
        }
      }
    }
  } else {
    mutableErrors.push({ field: 'player.equipment', message: 'player.equipment must be an object' });
  }

  validateKnownRingSchools(player, mutableErrors);
}

function validateLearnedRingSpellIds(
  learnedRingSpellIds: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (!Array.isArray(learnedRingSpellIds)) {
    mutableErrors.push({
      field: 'player.learnedRingSpellIds',
      message: 'player.learnedRingSpellIds must be an array',
    });
    return;
  }

  learnedRingSpellIds.forEach((spellId, index) => {
    if (typeof spellId !== 'string' || !RING_SPELL_BY_ID.has(spellId)) {
      mutableErrors.push({
        field: `player.learnedRingSpellIds[${index}]`,
        message: `player.learnedRingSpellIds[${index}] must exist in RING_SPELL_BY_ID`,
      });
    }
  });
}

function validateEquipmentSlotCompatibility(
  slot: string,
  itemEntityId: string,
  item: Record<string, unknown>,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (slot === 'weapon' || slot === 'secondaryWeapon') {
    if (item['itemClass'] !== 'weapon') {
      mutableErrors.push({
        field: `player.equipment.${slot}`,
        message: `item "${itemEntityId}" is not a valid weapon (got ${describeItemKind(item)})`,
      });
    }
    return;
  }

  const expectedArmorSlot = getExpectedArmorSlot(slot);
  if (expectedArmorSlot === null) {
    return;
  }

  const armor = item['armor'];
  if (item['itemClass'] !== 'armor' || !isRecord(armor) || armor['slot'] !== expectedArmorSlot) {
    mutableErrors.push({
      field: `player.equipment.${slot}`,
      message: `item "${itemEntityId}" is not valid for ${slot} slot (got ${describeItemKind(item)})`,
    });
  }
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
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (Array.isArray(player['knownRingSchools'])) {
    for (const [index, school] of player['knownRingSchools'].entries()) {
      if (typeof school !== 'string' || !RING_SCHOOL_BY_ID.has(school)) {
        const field = `player.knownRingSchools[${index}]`;
        mutableErrors.push({ field, message: `${field} references unknown ring school ${String(school)}` });
      }
    }
  }

  if (isRecord(player['ringMastery'])) {
    for (const school of Object.keys(player['ringMastery'])) {
      if (!RING_SCHOOL_BY_ID.has(school)) {
        mutableErrors.push({
          field: `player.ringMastery.${school}`,
          message: 'ring mastery school must exist in content',
        });
      }
    }
  }
}

function validateWorld(
  world: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (!isRecord(world)) {
    mutableErrors.push({ field: 'world', message: 'world must be an object' });
    return;
  }

  if (!isRecord(world['town'])) {
    mutableErrors.push({ field: 'world.town', message: 'world.town must be an object' });
  }
  if (!Array.isArray(world['factions'])) {
    mutableErrors.push({ field: 'world.factions', message: 'world.factions must be an array' });
  }
  if (!isRecord(world['dungeonOgre'])) {
    mutableErrors.push({ field: 'world.dungeonOgre', message: 'world.dungeonOgre must be an object' });
  }
}

function validateRunAndFloor(
  snapshot: Record<string, unknown>,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  const run = snapshot['run'];
  const floor = snapshot['floor'];
  const enemies = snapshot['enemies'];

  if (run !== null && !isRecord(run)) {
    mutableErrors.push({ field: 'run', message: 'run must be an object or null' });
    return;
  }

  if (run === null) {
    if (floor !== null) {
      mutableErrors.push({ field: 'floor', message: 'floor must be null when run is null' });
    }
    return;
  }

  pushFiniteNumberError(run['turnCount'], 'run.turnCount', mutableErrors);
  if (typeof run['runId'] !== 'string' || run['runId'].length === 0) {
    mutableErrors.push({ field: 'run.runId', message: 'runId must be a non-empty string' });
  }
  if (typeof run['isActive'] !== 'boolean') {
    mutableErrors.push({ field: 'run.isActive', message: 'run.isActive must be a boolean' });
  }
  if (!isRecord(run['speedAccumulators'])) {
    mutableErrors.push({ field: 'run.speedAccumulators', message: 'speedAccumulators must be an object' });
  } else {
    for (const [key, value] of Object.entries(run['speedAccumulators'])) {
      const field = `run.speedAccumulators[${key}]`;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        mutableErrors.push({ field, message: `${field} must be a finite number` });
      }
    }
  }

  if (!isRecord(floor)) {
    mutableErrors.push({ field: 'floor', message: 'floor must be an object for active runs' });
    validateEnemies(enemies, { cells: {} }, snapshot['player'], mutableErrors);
    return;
  }

  validateFloor(floor, 'floor', mutableErrors);
  validateEnemies(enemies, floor, snapshot['player'], mutableErrors);
}

function validateFloor(
  floor: Record<string, unknown>,
  fieldPrefix: string,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  pushPositiveIntegerError(floor['width'], `${fieldPrefix}.width`, mutableErrors);
  pushPositiveIntegerError(floor['height'], `${fieldPrefix}.height`, mutableErrors);
  pushPositiveIntegerError(floor['depth'], `${fieldPrefix}.depth`, mutableErrors);
  if (typeof floor['biomeId'] !== 'string' || floor['biomeId'].length === 0) {
    mutableErrors.push({ field: `${fieldPrefix}.biomeId`, message: 'biomeId must be a non-empty string' });
  }
  if (!isRecord(floor['cells']) || Object.keys(floor['cells']).length === 0) {
    mutableErrors.push({ field: `${fieldPrefix}.cells`, message: 'floor cells must be a non-empty object' });
  }
  if (!isPosition(floor['entrance'])) {
    mutableErrors.push({ field: `${fieldPrefix}.entrance`, message: 'entrance must be a position' });
  }
  if (!isPosition(floor['exit'])) {
    mutableErrors.push({ field: `${fieldPrefix}.exit`, message: 'exit must be a position' });
  }
}

function validateEnemies(
  enemies: unknown,
  floor: Record<string, unknown>,
  player: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (!isRecord(enemies)) {
    mutableErrors.push({ field: 'enemies', message: 'enemies must be an object' });
    return;
  }

  const cells = isRecord(floor['cells']) ? floor['cells'] : {};
  if (isRecord(player) && isPosition(player['position'])) {
    const playerPositionKey = posKey(player['position']);
    if (!Object.prototype.hasOwnProperty.call(cells, playerPositionKey)) {
      mutableErrors.push({ field: 'floor.cells', message: 'floor cells must include player position' });
    }
  }

  for (const [key, enemy] of Object.entries(enemies)) {
    validateEnemy(key, enemy, cells, mutableErrors);
  }
}

function validateEnemy(
  key: string,
  enemy: unknown,
  cells: Record<string, unknown>,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (!isRecord(enemy)) {
    mutableErrors.push({ field: `enemies[${key}]`, message: 'enemy must be an object' });
    return;
  }

  const templateId = enemy['templateId'];
  if (typeof templateId !== 'string' || !ENEMY_TEMPLATES.has(templateId)) {
    mutableErrors.push({
      field: `enemies[${key}].templateId`,
      message: `enemy template id ${String(templateId)} must exist in ENEMY_TEMPLATES`,
    });
  }
  if (!isPosition(enemy['position'])) {
    mutableErrors.push({ field: `enemies[${key}].position`, message: 'enemy position must be a position' });
    return;
  }

  const expectedKey = posKey(enemy['position']);
  if (expectedKey !== key) {
    mutableErrors.push({
      field: `enemies[${key}].position`,
      message: `enemy map key must match enemy position ${expectedKey}`,
    });
  }
  if (!Object.prototype.hasOwnProperty.call(cells, expectedKey)) {
    mutableErrors.push({
      field: `enemies[${key}].position`,
      message: 'enemy position must reference an existing floor cell',
    });
  }
}

function validateObjects(objects: unknown, floor: unknown, mutableErrors: SaveSnapshotValidationError[]): void {
  if (!isRecord(objects)) {
    mutableErrors.push({ field: 'objects', message: 'objects must be an object' });
    return;
  }
  const cells = isRecord(floor) && isRecord(floor['cells']) ? floor['cells'] : {};
  for (const [key, object] of Object.entries(objects)) {
    if (!isRecord(object)) {
      mutableErrors.push({ field: `objects[${key}]`, message: 'object must be an object' });
      continue;
    }
    const templateId = object['templateId'];
    if (typeof templateId !== 'string' || !OBJECT_TEMPLATES.has(templateId)) {
      mutableErrors.push({
        field: `objects[${key}].templateId`,
        message: `object template id ${String(templateId)} must exist in OBJECT_TEMPLATES`,
      });
    }
    validateObjectPosition(key, object['position'], mutableErrors);
    if (isPosition(object['position'])) {
      const expectedKey = posKey(object['position']);
      if (expectedKey !== key) {
        mutableErrors.push({ field: `objects[${key}].position`, message: `object map key must match object position ${expectedKey}` });
      } else if (!Object.prototype.hasOwnProperty.call(cells, key)) {
        mutableErrors.push({ field: `objects[${key}].position`, message: 'object position must reference an existing floor cell' });
      }
    }
    if (typeof object['isExhausted'] !== 'boolean') {
      const field = `objects[${key}].isExhausted`;
      mutableErrors.push({ field, message: `${field} must be a boolean` });
    }
  }
}

function validateObjectPosition(
  key: string,
  position: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  const positionRecord = isRecord(position) ? position : null;
  for (const axis of ['x', 'y'] as const) {
    const value = positionRecord?.[axis];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      const field = `objects[${key}].position.${axis}`;
      mutableErrors.push({ field, message: `${field} must be a number` });
    }
  }
}

function validatePersistedFloorCache(
  persistedFloorCache: unknown,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (persistedFloorCache === undefined) {
    return;
  }
  if (!isRecord(persistedFloorCache)) {
    mutableErrors.push({ field: 'persistedFloorCache', message: 'persistedFloorCache must be an object when present' });
    return;
  }

  for (const [depth, storedFloor] of Object.entries(persistedFloorCache)) {
    if (!isRecord(storedFloor)) {
      mutableErrors.push({ field: `persistedFloorCache.${depth}`, message: 'stored floor must be an object' });
      continue;
    }
    if (!isRecord(storedFloor['floor'])) {
      mutableErrors.push({ field: `persistedFloorCache.${depth}.floor`, message: 'stored floor must include floor data' });
      continue;
    }
    validateFloor(storedFloor['floor'], `persistedFloorCache.${depth}.floor`, mutableErrors);
  }
}

function getRegistryItems(itemRegistry: unknown): Set<string> {
  if (!isRecord(itemRegistry) || !isRecord(itemRegistry['items'])) {
    return new Set();
  }
  return new Set(Object.keys(itemRegistry['items']));
}

function getRegistryItemRecords(itemRegistry: unknown): Map<string, Record<string, unknown>> {
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
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    mutableErrors.push({ field, message: `${field} must be a finite number` });
  }
}

function pushPositiveIntegerError(
  value: unknown,
  field: string,
  mutableErrors: SaveSnapshotValidationError[],
): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    mutableErrors.push({ field, message: `${field} must be an integer >= 1` });
  }
}
