import type { SaveSnapshot, SaveSnapshotMetadata } from '@dungeon/contracts';

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

  try {
    return JSON.parse(raw) as SaveSnapshot;
  } catch (error) {
    throw new Error(
      `Failed to load save snapshot from ${slotId}: ${error instanceof Error ? error.message : 'invalid JSON'}`,
    );
  }
}

export function listSaveSlotMetadata(storage: Storage): SaveSlotMetadata[] {
  return SAVE_SLOT_IDS.map(slotId => {
    const keys = getSaveSlotStorageKeys(slotId);
    const raw = storage.getItem(keys.metadata);
    if (raw === null) {
      return { slotId, isEmpty: true };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SaveSlotMetadata>;
      if (parsed.isEmpty === false && hasCompleteMetadata(parsed)) {
        return {
          slotId,
          isEmpty: false,
          saveTimestamp: parsed.saveTimestamp,
          characterLevel: parsed.characterLevel,
          currentFloor: parsed.currentFloor,
          ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
        };
      }
    } catch {
      return { slotId, isEmpty: true };
    }

    return { slotId, isEmpty: true };
  });
}

export function clearSaveSlot(storage: Storage, slotId: SaveSlotId): void {
  const keys = getSaveSlotStorageKeys(slotId);
  storage.removeItem(keys.snapshot);
  storage.removeItem(keys.metadata);
}

function assertValidSlotId(slotId: SaveSlotId): void {
  if (!VALID_SLOT_IDS.has(slotId)) {
    throw new Error(`Unsupported save slot ${slotId}. Expected one of: ${SAVE_SLOT_IDS.join(', ')}.`);
  }
}

function hasCompleteMetadata(
  value: Partial<SaveSlotMetadata>,
): value is SaveSlotMetadata & { readonly isEmpty: false } {
  return value.isEmpty === false
    && typeof value.saveTimestamp === 'number'
    && typeof value.characterLevel === 'number'
    && typeof value.currentFloor === 'number'
    && (value.displayName === undefined || typeof value.displayName === 'string');
}
