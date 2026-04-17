import type { ObjectTemplate } from '@dungeon/contracts';

export const poisonTrap: ObjectTemplate = {
  templateId: 'poison_trap',
  name: 'Poison Trap',
  description: 'A hidden trap that releases toxic gas when triggered.',
  ascii: 'p',
  color: '#00ff00',
  spriteName: 'poisonous fog',
  healthDelta: -20,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  statusEffect: 'poison',
  hazardType: 'poison',
  biomes: [{ biomeId: 'goblin_warrens' }, { biomeId: 'stone_crypt' }],
};
