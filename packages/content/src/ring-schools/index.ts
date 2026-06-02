// Auto-generated — do not edit manually
import type { RingSchoolDefinition } from './types.js';
import { fire } from './fire.js';
import { lightning } from './lightning.js';

const items: [string, RingSchoolDefinition][] = [
  [fire.id, fire],
  [lightning.id, lightning],
];

export const RING_SCHOOL_BY_ID: ReadonlyMap<string, RingSchoolDefinition> = new Map(items);

export {
  fire, lightning,
};

export * from './utilities.js';

// Add custom utilities below this line ↓
