import { lightningRing } from '../items/armor/lightning-ring.js';
import type { RingSchoolDefinition } from './types.js';

export const lightning: RingSchoolDefinition = {
  id: 'lightning',
  label: 'Lightning',
  ringId: lightningRing.itemId,
  description: 'Channel the power of lightning to shock and stun your enemies.',
};
