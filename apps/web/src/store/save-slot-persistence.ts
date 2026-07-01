import type {
  SaveSnapshot,
  SaveSnapshotMetadata,
} from '@dungeon/contracts';

export const SAVE_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'] as const;

export type SaveSlotId = typeof SAVE_SLOT_IDS[number];

export interface SaveSlotStorageKeys {
  readonly metadata: string;
  readonly snapshot: string;
}

export type SaveSlotMetadata =
  | {
      readonly slotId: SaveSlotId;
      readonly isEmpty: true;
    }
  | ({
      readonly slotId: SaveSlotId;
      readonly isEmpty: false;
    } & SaveSnapshotMetadata);

const STORAGE_PREFIX = 'dungeon-save-slot';
const VALID_SLOT_IDS = new Set<string>(SAVE_SLOT_IDS);

export function getSaveSlotStorageKeys(slotId: SaveSlotId): SaveSlotStorageKeys {
  assertValidSlotId(slotId);
  return {
    metadata: `${STORAGE_PREFIX}:${slotId}:metadata`,
    snapshot: `${STORAGE_PREFIX}:${slotId}:snapshot`,
  };
}

export function saveSnapshotToSlot(
  storage: Storage,
  slotId: SaveSlotId,
  snapshot: SaveSnapshot,
): void {
  const keys = getSaveSlotStorageKeys(slotId);
  storage.setItem(keys.snapshot, JSON.stringify(snapshot));
  storage.setItem(keys.metadata, JSON.stringify({
    slotId,
    isEmpty: false,
    ...snapshot.metadata,
  } satisfies SaveSlotMetadata));
}

export function loadSnapshotFromSlot(
  storage: Storage,
  slotId: SaveSlotId,
): SaveSnapshot | null {
  const keys = getSaveSlotStorageKeys(slotId);
  const raw = storage.getItem(keys.snapshot);
  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to load save snapshot from ${slotId}: ${error instanceof Error ? error.message : 'invalid JSON'}`,
    );
  }

  return parsed as unknown as SaveSnapshot;
}

export function listSaveSlotMetadata(storage: Storage): SaveSlotMetadata[] {
  return SAVE_SLOT_IDS.map(slotId => {
    const keys = getSaveSlotStorageKeys(slotId);
    const raw = storage.getItem(keys.metadata);
    if (raw === null) {
      if (storage.getItem(keys.snapshot) !== null) {
        throw new Error(`Save slot ${slotId} has corrupted metadata: snapshot exists but metadata is missing`);
      }
      return { slotId, isEmpty: true };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      throw new Error(
        `Save slot ${slotId} has corrupted metadata: ${error instanceof Error ? error.message : 'invalid JSON'}`,
      );
    }

    if (!isRecord(parsed)) {
      throw new Error(`Save slot ${slotId} has corrupted metadata`);
    }
    if (parsed.isEmpty === true) {
      return { slotId, isEmpty: true };
    }
    if (parsed.isEmpty !== false || !hasCompleteMetadata(parsed)) {
      throw new Error(`Save slot ${slotId} has corrupted metadata`);
    }
    return {
      slotId,
      isEmpty: false,
      saveTimestamp: parsed.saveTimestamp,
      characterLevel: parsed.characterLevel,
      currentFloor: parsed.currentFloor,
      ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
    };
  });
}

export function clearSaveSlot(storage: Storage, slotId: SaveSlotId): void {
  const keys = getSaveSlotStorageKeys(slotId);
  storage.removeItem(keys.snapshot);
  try {
    storage.removeItem(keys.metadata);
  } catch {
    // Best-effort cleanup: the snapshot removal is the source of truth for load.
  }
}

function assertValidSlotId(slotId: SaveSlotId): void {
  if (!VALID_SLOT_IDS.has(slotId)) {
    throw new Error(`Unsupported save slot ${slotId}. Expected one of: ${SAVE_SLOT_IDS.join(', ')}.`);
  }
}

function hasCompleteMetadata(
  value: Record<string, unknown>,
): value is {
  readonly isEmpty: false;
  readonly saveTimestamp: number;
  readonly characterLevel: number;
  readonly currentFloor: number;
  readonly displayName?: string;
} {
  return value.isEmpty === false
    && typeof value.saveTimestamp === 'number'
    && typeof value.characterLevel === 'number'
    && typeof value.currentFloor === 'number'
    && (value.displayName === undefined || typeof value.displayName === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
