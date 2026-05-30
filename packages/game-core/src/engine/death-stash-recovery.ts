import type { DomainEvent, GameState } from '@dungeon/contracts';

export function recoverDeathStash(
  state: GameState,
  floorDepth: number,
): { state: GameState; events: DomainEvent[] } | null {
  const stash = state.player.deathStash;
  if (!stash || stash.floor !== floorDepth) {
    return null;
  }

  const newRegistry = new Map(state.itemRegistry.items);
  let newInventory = [...state.player.inventory];

  for (const stashItem of stash.items) {
    newRegistry.set(stashItem.entityId, stashItem.item);
    newInventory = [...newInventory, stashItem.entityId];
  }

  const events: DomainEvent[] = [{
    type: 'EQUIPMENT_RECOVERED',
    items: stash.items.map(stashItem => ({ slot: stashItem.slot, itemName: stashItem.item.name })),
    floor: floorDepth,
    timestamp: state.turnNumber,
    turnNumber: state.turnNumber,
  }];

  return {
    state: {
      ...state,
      player: {
        ...state.player,
        inventory: newInventory,
        deathStash: null,
      },
      itemRegistry: { items: newRegistry },
    },
    events,
  };
}
