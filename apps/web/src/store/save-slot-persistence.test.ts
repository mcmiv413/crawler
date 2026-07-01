import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_SNAPSHOT_SCHEMA_VERSION } from '@dungeon/contracts';
import {
  clearSaveSlot,
  getSaveSlotStorageKeys,
  listSaveSlotMetadata,
  loadSnapshotFromSlot,
  saveSnapshotToSlot,
  SAVE_SLOT_IDS,
  type SaveSlotId,
} from './save-slot-persistence.js';

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

class RecordingStorage extends MemoryStorage {
  readonly operations: string[] = [];

  override removeItem(key: string): void {
    this.operations.push(`remove:${key}`);
    super.removeItem(key);
  }

  override setItem(key: string, value: string): void {
    this.operations.push(`set:${key}`);
    super.setItem(key, value);
  }
}

function makeSnapshot(options: {
  readonly level: number;
  readonly floor: number;
  readonly turnNumber: number;
  readonly displayName?: string;
}) {
  return {
    schemaVersion: SAVE_SNAPSHOT_SCHEMA_VERSION,
    metadata: {
      saveTimestamp: options.turnNumber,
      characterLevel: options.level,
      currentFloor: options.floor,
      ...(options.displayName !== undefined ? { displayName: options.displayName } : {}),
    },
    gameId: `game-${options.level}-${options.floor}`,
    phase: 'town',
    player: {
      level: options.level,
      floor: options.floor,
    },
    world: {},
    run: null,
    floor: null,
    enemies: {},
    objects: {},
    itemRegistry: { items: {} },
    seed: options.floor,
    turnNumber: options.turnNumber,
    version: 1,
    activeQuests: [],
    weaponMastery: {
      blade: 0,
      bludgeon: 0,
      axe: 0,
      ranged: 0,
      dagger: 0,
    },
  };
}

describe('save slot persistence', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('Test Group 8: stores and restores three independent save slots without contamination', () => {
    const first = makeSnapshot({ level: 1, floor: 1, turnNumber: 11, displayName: 'Start' });
    const second = makeSnapshot({ level: 5, floor: 4, turnNumber: 44, displayName: 'Midgame' });
    const third = makeSnapshot({ level: 9, floor: 8, turnNumber: 88, displayName: 'Deep Run' });

    saveSnapshotToSlot(storage, 'slot-1', first);
    saveSnapshotToSlot(storage, 'slot-2', second);
    saveSnapshotToSlot(storage, 'slot-3', third);

    expect(SAVE_SLOT_IDS).toEqual(['slot-1', 'slot-2', 'slot-3']);
    expect(loadSnapshotFromSlot(storage, 'slot-1')).toEqual(first);
    expect(loadSnapshotFromSlot(storage, 'slot-2')).toEqual(second);
    expect(loadSnapshotFromSlot(storage, 'slot-3')).toEqual(third);

    saveSnapshotToSlot(storage, 'slot-2', makeSnapshot({
      level: 6,
      floor: 5,
      turnNumber: 55,
      displayName: 'Updated Midgame',
    }));

    expect(loadSnapshotFromSlot(storage, 'slot-1')).toEqual(first);
    expect(loadSnapshotFromSlot(storage, 'slot-2')).toMatchObject({ metadata: { characterLevel: 6 } });
    expect(loadSnapshotFromSlot(storage, 'slot-3')).toEqual(third);
  });

  it('Test Group 11: exposes save metadata from slot records without loading full snapshots', () => {
    const snapshot = makeSnapshot({ level: 7, floor: 6, turnNumber: 123, displayName: 'Boss Door' });
    saveSnapshotToSlot(storage, 'slot-1', snapshot);

    const keys = getSaveSlotStorageKeys('slot-1');
    storage.setItem(keys.snapshot, '{corrupt snapshot json');

    const metadata = listSaveSlotMetadata(storage);
    const firstSlot = metadata.find(slot => slot.slotId === 'slot-1');

    expect(firstSlot).toEqual({
      slotId: 'slot-1',
      isEmpty: false,
      saveTimestamp: 123,
      characterLevel: 7,
      currentFloor: 6,
      displayName: 'Boss Door',
    });
    expect(() => loadSnapshotFromSlot(storage, 'slot-1')).toThrow(/slot-1/);
  });

  it('returns snapshots with unsupported or missing schema versions for downstream validation', () => {
    const keys = getSaveSlotStorageKeys('slot-1');
    const unsupportedVersion = {
      ...makeSnapshot({ level: 1, floor: 1, turnNumber: 11 }),
      schemaVersion: SAVE_SNAPSHOT_SCHEMA_VERSION + 1,
    };
    storage.setItem(keys.snapshot, JSON.stringify(unsupportedVersion));

    expect(loadSnapshotFromSlot(storage, 'slot-1')).toEqual(unsupportedVersion);

    const missingVersion: Record<string, unknown> = {
      ...makeSnapshot({ level: 1, floor: 1, turnNumber: 11 }),
    };
    delete missingVersion['schemaVersion'];
    storage.setItem(keys.snapshot, JSON.stringify(missingVersion));

    expect(loadSnapshotFromSlot(storage, 'slot-1')).toEqual(missingVersion);
  });

  it('throws on incomplete occupied metadata instead of reporting the slot empty', () => {
    const keys = getSaveSlotStorageKeys('slot-1');
    storage.setItem(keys.metadata, JSON.stringify({
      slotId: 'slot-1',
      isEmpty: false,
      saveTimestamp: 123,
      currentFloor: 6,
    }));

    expect(() => listSaveSlotMetadata(storage)).toThrow(/slot-1.*corrupted metadata/);
  });

  it('rejects writes outside the three supported slots and clears slots atomically', () => {
    const snapshot = makeSnapshot({ level: 2, floor: 2, turnNumber: 22 });

    expect(() => saveSnapshotToSlot(
      storage,
      'slot-4' as SaveSlotId,
      snapshot,
    )).toThrow(/slot-4/);

    saveSnapshotToSlot(storage, 'slot-1', snapshot);
    expect(loadSnapshotFromSlot(storage, 'slot-1')).toEqual(snapshot);

    clearSaveSlot(storage, 'slot-1');

    expect(loadSnapshotFromSlot(storage, 'slot-1')).toBeNull();
    expect(listSaveSlotMetadata(storage).find(slot => slot.slotId === 'slot-1')).toEqual({
      slotId: 'slot-1',
      isEmpty: true,
    });
  });

  it('removes snapshot and metadata without writing a tombstone while clearing', () => {
    const keys = getSaveSlotStorageKeys('slot-1');
    const recordingStorage = new RecordingStorage();
    storage = recordingStorage;
    const snapshot = makeSnapshot({ level: 2, floor: 2, turnNumber: 22 });
    saveSnapshotToSlot(storage, 'slot-1', snapshot);
    recordingStorage.operations.length = 0;

    expect(() => clearSaveSlot(storage, 'slot-1')).not.toThrow();

    expect(loadSnapshotFromSlot(storage, 'slot-1')).toBeNull();
    expect(storage.getItem(keys.metadata)).toBeNull();
    expect(listSaveSlotMetadata(storage).find(slot => slot.slotId === 'slot-1')).toEqual({
      slotId: 'slot-1',
      isEmpty: true,
    });
    expect(recordingStorage.operations).toEqual([
      `remove:${keys.snapshot}`,
      `remove:${keys.metadata}`,
    ]);
  });
});
