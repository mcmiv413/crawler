// Auto-generated — do not edit manually
import type { StatusDefinition } from './types.js';
import { arcaneCharge } from './arcane-charge.js';
import { bleed } from './bleed.js';
import { burn } from './burn.js';
import { heatSurgeStatus } from './heat-surge-status.js';
import { panic } from './panic.js';
import { poison } from './poison.js';
import { regeneration } from './regeneration.js';
import { slow } from './slow.js';
import { stormActive } from './storm-active.js';
import { strength } from './strength.js';
import { stun } from './stun.js';
import { vulnerability } from './vulnerability.js';
import { weaken } from './weaken.js';

const items: [string, StatusDefinition][] = [
  [arcaneCharge.id, arcaneCharge],
  [bleed.id, bleed],
  [burn.id, burn],
  [heatSurgeStatus.id, heatSurgeStatus],
  [panic.id, panic],
  [poison.id, poison],
  [regeneration.id, regeneration],
  [slow.id, slow],
  [stormActive.id, stormActive],
  [strength.id, strength],
  [stun.id, stun],
  [vulnerability.id, vulnerability],
  [weaken.id, weaken],
];

export const STATUS_DEFINITIONS: ReadonlyMap<string, StatusDefinition> = new Map(items);

export {
  arcaneCharge, bleed, burn, heatSurgeStatus, panic, poison, regeneration, slow, stormActive, strength, stun, vulnerability, weaken,
};

// Add custom utilities below this line ↓
