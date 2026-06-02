// Auto-generated — do not edit manually
import type { RingSpellDefinition } from './types.js';
import { bolt } from './bolt.js';
import { cinderWake } from './cinder-wake.js';
import { ember } from './ember.js';
import { heatSurge } from './heat-surge.js';
import { plasmaArc } from './plasma-arc.js';
import { rollingThunder } from './rolling-thunder.js';
import { stormfire } from './stormfire.js';
import { thunderStep } from './thunder-step.js';
import { thunderstorm } from './thunderstorm.js';

const items: [string, RingSpellDefinition][] = [
  [bolt.id, bolt],
  [cinderWake.id, cinderWake],
  [ember.id, ember],
  [heatSurge.id, heatSurge],
  [plasmaArc.id, plasmaArc],
  [rollingThunder.id, rollingThunder],
  [stormfire.id, stormfire],
  [thunderStep.id, thunderStep],
  [thunderstorm.id, thunderstorm],
];

export const RING_SPELL_BY_ID: ReadonlyMap<string, RingSpellDefinition> = new Map(items);

export {
  bolt, cinderWake, ember, heatSurge, plasmaArc, rollingThunder, stormfire, thunderStep, thunderstorm,
};

// Add custom utilities below this line ↓
