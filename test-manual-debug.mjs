import { ABILITY_DEFINITIONS } from './packages/content/dist/index.js';

console.log('bludgeon_stagger in ABILITY_DEFINITIONS:', 'bludgeon_stagger' in ABILITY_DEFINITIONS);
const def = ABILITY_DEFINITIONS['bludgeon_stagger'];
console.log('def:', def);
console.log('def?.requiresWeaponTypes:', def?.requiresWeaponTypes);
