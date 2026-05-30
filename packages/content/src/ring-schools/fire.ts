import { fireRing } from '../items/armor/fire-ring.js';
import type { RingSchoolDefinition } from './types.js';

export const fire: RingSchoolDefinition = {
  id: 'fire',
  label: 'Fire',
  ringId: fireRing.itemId,
  description: 'Harness destructive flame to burn and panic your enemies.',
};
