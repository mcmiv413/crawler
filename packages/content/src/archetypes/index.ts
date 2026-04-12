import type { ArchetypeDefinition } from '@dungeon/contracts';
import { AGGRESSIVE_MELEE } from './aggressive-melee.js';
import { SKITTISH_RANGED } from './skittish-ranged.js';
import { CAUTIOUS_DEFENSIVE } from './cautious-defensive.js';
import { AMBUSHER } from './ambusher.js';
import { HAZARD_CREATOR } from './hazard-creator.js';

const archetypes: [string, ArchetypeDefinition][] = [
  [AGGRESSIVE_MELEE.id, AGGRESSIVE_MELEE],
  [SKITTISH_RANGED.id, SKITTISH_RANGED],
  [CAUTIOUS_DEFENSIVE.id, CAUTIOUS_DEFENSIVE],
  [AMBUSHER.id, AMBUSHER],
  [HAZARD_CREATOR.id, HAZARD_CREATOR],
];

export const ARCHETYPES: ReadonlyMap<string, ArchetypeDefinition> = new Map(archetypes);

export {
  AGGRESSIVE_MELEE,
  SKITTISH_RANGED,
  CAUTIOUS_DEFENSIVE,
  AMBUSHER,
  HAZARD_CREATOR,
};
