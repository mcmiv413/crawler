import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_SNAPSHOT_SCHEMA_VERSION, type SaveSnapshot } from '@dungeon/contracts';
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

class MetadataRemoveFailureStorage extends MemoryStorage {
  constructor(private readonly metadataKey: string) {
    super();
  }

  override removeItem(key: string): void {
    if (key === this.metadataKey) {
      throw new Error('metadata remove failed');
    }
    super.removeItem(key);
  }
}

function makeSnapshot(options: {
  readonly level: number;
  readonly floor: number;
  readonly turnNumber: number;
  readonly displayName?: string;
}): SaveSnapshot {
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
  } as unknown as SaveSnapshot;
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
    expect(loadSnapshotFromSlot(storage, 'slot-2')?.metadata.characterLevel).toBe(6);
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

  it('rejects snapshots with unsupported or missing schema versions', () => {
    const keys = getSaveSlotStorageKeys('slot-1');
    storage.setItem(keys.snapshot, JSON.stringify({
      ...makeSnapshot({ level: 1, floor: 1, turnNumber: 11 }),
      schemaVersion: SAVE_SNAPSHOT_SCHEMA_VERSION + 1,
    }));

    expect(() => loadSnapshotFromSlot(storage, 'slot-1')).toThrow(
      `Save slot slot-1 has schema version ${SAVE_SNAPSHOT_SCHEMA_VERSION + 1}, expected ${SAVE_SNAPSHOT_SCHEMA_VERSION}`,
    );

    const missingVersion: Record<string, unknown> = {
      ...makeSnapshot({ level: 1, floor: 1, turnNumber: 11 }),
    };
    delete missingVersion['schemaVersion'];
    storage.setItem(keys.snapshot, JSON.stringify(missingVersion));

    expect(() => loadSnapshotFromSlot(storage, 'slot-1')).toThrow(
      `Save slot slot-1 has schema version undefined, expected ${SAVE_SNAPSHOT_SCHEMA_VERSION}`,
    );
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

  it('leaves an empty-slot tombstone if final metadata removal fails while clearing', () => {
    const keys = getSaveSlotStorageKeys('slot-1');
    storage = new MetadataRemoveFailureStorage(keys.metadata);
    const snapshot = makeSnapshot({ level: 2, floor: 2, turnNumber: 22 });
    saveSnapshotToSlot(storage, 'slot-1', snapshot);

    expect(() => clearSaveSlot(storage, 'slot-1')).not.toThrow();

    expect(loadSnapshotFromSlot(storage, 'slot-1')).toBeNull();
    expect(JSON.parse(storage.getItem(keys.metadata) ?? '{}')).toEqual({
      slotId: 'slot-1',
      isEmpty: true,
    });
    expect(listSaveSlotMetadata(storage).find(slot => slot.slotId === 'slot-1')).toEqual({
      slotId: 'slot-1',
      isEmpty: true,
    });
  });
});
