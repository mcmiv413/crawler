// Auto-generated — do not edit manually
import type { AmbientBehaviorProfile } from '@dungeon/contracts';
import { swarmer } from './swarmer.js';
import { wallLurker } from './wall-lurker.js';
import { wanderer } from './wanderer.js';

const items: [string, AmbientBehaviorProfile][] = [
  [swarmer.id, swarmer],
  [wallLurker.id, wallLurker],
  [wanderer.id, wanderer],
];

export const AMBIENT_PROFILES: ReadonlyMap<string, AmbientBehaviorProfile> = new Map(items);

export {
  swarmer, wallLurker, wanderer,
};

// Add custom utilities below this line ↓
