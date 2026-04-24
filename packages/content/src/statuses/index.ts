// Auto-generated — do not edit manually
import type { StatusDefinition } from './types.js';
import { bleed } from './bleed.js';
import { burn } from './burn.js';
import { poison } from './poison.js';
import { regeneration } from './regeneration.js';
import { slow } from './slow.js';
import { strength } from './strength.js';
import { stun } from './stun.js';
import { vulnerability } from './vulnerability.js';
import { weaken } from './weaken.js';

const items: [string, StatusDefinition][] = [
  [bleed.id, bleed],
  [burn.id, burn],
  [poison.id, poison],
  [regeneration.id, regeneration],
  [slow.id, slow],
  [strength.id, strength],
  [stun.id, stun],
  [vulnerability.id, vulnerability],
  [weaken.id, weaken],
];

export const STATUS_DEFINITIONS: ReadonlyMap<string, StatusDefinition> = new Map(items);

export {
  bleed, burn, poison, regeneration, slow, strength, stun, vulnerability, weaken,
};

// Add custom utilities below this line ↓
