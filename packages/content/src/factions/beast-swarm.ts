import type { FactionDefinition } from './types.js';

export const beastSwarm: FactionDefinition = {
  id: 'beast_swarm',
  name: 'Beast Swarm',
  description: 'A primal collective of mutated creatures.',
  lore: 'Born from the dungeon\'s corruption, these beasts thrive in the moss-filled caverns. Hunger drives them to attack anything moving, mindless yet cunning in their ferocity.',
  initialPower: 50,
  initialDisposition: -20,
  leader: {
    templateId: 'brood_matriarch',
    names: ['Skarra', 'Thornmaw', 'Goruun'],
    titles: ['Brood-Mother', 'Root Alpha', 'Ember Maw'],
  },
};
