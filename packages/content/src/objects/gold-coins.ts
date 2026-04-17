import type { ObjectTemplate } from '@dungeon/contracts';

export const goldCoins: ObjectTemplate = {
  templateId: 'gold_coins',
  name: 'Gold Coins',
  description: 'A glittering pile of gold coins. Amount scales with depth.',
  ascii: '$',
  color: '#ffdd00',
  spriteName: 'pile of gold coins',
  healthDelta: 0,
  consumable: true,
  blocksMovement: false,
  rarity: 'uncommon',
  objectCategory: 'misc',
  goldDeltaMin: 5,
  goldDeltaMax: 15,
};
