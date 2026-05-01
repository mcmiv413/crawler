// Auto-generated — do not edit manually
import type { FactionDefinition } from './types.js';
import { beastSwarm } from './beast-swarm.js';
import { goblinWarband } from './goblin-warband.js';
import { shadowCult } from './shadow-cult.js';
import { undeadLegion } from './undead-legion.js';

const items: [string, FactionDefinition][] = [
  [beastSwarm.id, beastSwarm],
  [goblinWarband.id, goblinWarband],
  [shadowCult.id, shadowCult],
  [undeadLegion.id, undeadLegion],
];

export const FACTION_DEFINITIONS: ReadonlyMap<string, FactionDefinition> = new Map(items);

import type { DungeonOgreState, FactionState } from '@dungeon/contracts';
export const FACTIONS = FACTION_DEFINITIONS;
export const INITIAL_FACTIONS: readonly FactionState[] = Array.from(FACTION_DEFINITIONS.values()).map(f => ({
  id: f.id,
  name: f.name,
  power: f.initialPower,
  disposition: f.initialDisposition,
  status: 'leaderless',
  leader: null,
  leaderSlain: false,
  membersKilledByPlayer: 0,
  leadersKilledByPlayer: 0,
  playerDeathsCaused: 0,
}));
export const INITIAL_DUNGEON_OGRE: DungeonOgreState = {
  id: 'dungeon_ogre',
  status: 'sealed',
};
export * from './types.js';

export {
  beastSwarm, goblinWarband, shadowCult, undeadLegion,
};

export * from './utilities.js';

// Add custom utilities below this line ↓
