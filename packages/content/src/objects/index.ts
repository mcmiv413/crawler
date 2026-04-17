import type { ObjectTemplate } from '@dungeon/contracts';
import { chest } from './chest.js';
import { firePit } from './fire-pit.js';
import { healingFountain } from './healing-fountain.js';
import { healingPond } from './healing-pond.js';
import { healingAltar } from './healing-altar.js';
import { arcaneAltar } from './arcane-altar.js';
import { trapSpikes } from './trap-spikes.js';
import { poisonTrap } from './poison-trap.js';
import { frostTrap } from './frost-trap.js';
import { lightningTrap } from './lightning-trap.js';
import { infernoPit } from './inferno-pit.js';
import { goldCoins } from './gold-coins.js';

const templates: [string, ObjectTemplate][] = [
  [chest.templateId, chest],
  [firePit.templateId, firePit],
  [healingFountain.templateId, healingFountain],
  [healingPond.templateId, healingPond],
  [healingAltar.templateId, healingAltar],
  [arcaneAltar.templateId, arcaneAltar],
  [trapSpikes.templateId, trapSpikes],
  [poisonTrap.templateId, poisonTrap],
  [frostTrap.templateId, frostTrap],
  [lightningTrap.templateId, lightningTrap],
  [infernoPit.templateId, infernoPit],
  [goldCoins.templateId, goldCoins],
];

export const OBJECT_TEMPLATES: ReadonlyMap<string, ObjectTemplate> = new Map(templates);

export {
  chest,
  firePit,
  healingFountain,
  healingPond,
  healingAltar,
  arcaneAltar,
  trapSpikes,
  poisonTrap,
  frostTrap,
  lightningTrap,
  infernoPit,
  goldCoins,
};
