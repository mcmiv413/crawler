import type { TrapItemTemplate } from '@dungeon/contracts';
import { FIRE_PIT_RARITY } from '../../objects/fire-pit.js';

export const fireTrap: TrapItemTemplate = {
  itemId: 'fire_trap',
  name: 'Fire Trap',
  description: 'A trap that ignites on contact. Sets targets ablaze.',
  itemClass: 'trap',
  rarity: FIRE_PIT_RARITY,
  value: 15,
  stackable: true,
  maxStack: 5,
  trapTemplateId: 'fire_pit',
};
