import type { ObjectTemplate } from '@dungeon/contracts';
import { buildByBiomeMap } from '../utils/biome-map.js';
import { chest } from './chest.js';
import { firePit } from './fire-pit.js';
import { healingFountain } from './healing-fountain.js';
import { arcaneAltar } from './arcane-altar.js';
import { trapSpikes } from './trap-spikes.js';

const templates: [string, ObjectTemplate][] = [
  [chest.templateId, chest],
  [firePit.templateId, firePit],
  [healingFountain.templateId, healingFountain],
  [arcaneAltar.templateId, arcaneAltar],
  [trapSpikes.templateId, trapSpikes],
];

export const OBJECT_TEMPLATES: ReadonlyMap<string, ObjectTemplate> = new Map(templates);

/** Precomputed map: biomeId → object templates that can spawn there */
export const OBJECTS_BY_BIOME = buildByBiomeMap(OBJECT_TEMPLATES);

export { chest, firePit, healingFountain, arcaneAltar, trapSpikes };
