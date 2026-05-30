import { shadowHierophant } from '../enemies/index.js';
import type { FactionDefinition } from './types.js';

export const shadowCult: FactionDefinition = {
  id: 'shadow_cult',
  name: 'Shadow Cult',
  description: 'Twisted cultists wielding dark arts.',
  lore: 'These shadowy servants of forgotten gods perform unspeakable rituals in the dungeon\'s deepest reaches. They view the surface as a realm of weakness, unworthy of their dark ambitions.',
  initialPower: 25,
  initialDisposition: -60,
  leader: {
    templateId: shadowHierophant.templateId,
    names: ['Velis', 'Ormira', 'Sethra'],
    titles: ['Night Voice', 'Veil-Mother', 'Ash Cantor'],
  },
};
