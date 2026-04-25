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

export {
  beastSwarm, goblinWarband, shadowCult, undeadLegion,
};

export * from './utilities.js';

// Add custom utilities below this line ↓
