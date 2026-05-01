import type { FactionDefinition } from './types.js';

export const undeadLegion: FactionDefinition = {
  id: 'undead_legion',
  name: 'Undead Legion',
  description: 'Ancient skeletal warriors bound by necromantic power.',
  lore: 'Cursed to eternal servitude, these undead guardians were sealed within the stone crypt ages ago. They remain locked in their ancient duties, hostile to all living intrusions.',
  initialPower: 30,
  initialDisposition: -50,
  leader: {
    templateId: 'lich_commander',
    names: ['Aser', 'Vharos', 'Nereth'],
    titles: ['Crypt-Marshal', 'Ashen Regent', 'Bone Standard'],
  },
};
