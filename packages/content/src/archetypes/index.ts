// Auto-generated — do not edit manually
import type { ArchetypeDefinition } from '@dungeon/contracts';
import { aggressiveMelee } from './aggressive-melee.js';
import { ambusher } from './ambusher.js';
import { cautiousDefensive } from './cautious-defensive.js';
import { hazardCreator } from './hazard-creator.js';
import { skittishRanged } from './skittish-ranged.js';

const items: [string, ArchetypeDefinition][] = [
  [aggressiveMelee.id, aggressiveMelee],
  [ambusher.id, ambusher],
  [cautiousDefensive.id, cautiousDefensive],
  [hazardCreator.id, hazardCreator],
  [skittishRanged.id, skittishRanged],
];

export const ARCHETYPES: ReadonlyMap<string, ArchetypeDefinition> = new Map(items);

export {
  aggressiveMelee, ambusher, cautiousDefensive, hazardCreator, skittishRanged,
};

// Add custom utilities below this line ↓
