import { createTestGameStateWithAbility } from './packages/game-core/dist/test-utils.js';
import { getEquippedWeaponType } from './packages/game-core/dist/engine/handlers/combat.js';

const state = createTestGameStateWithAbility('bludgeon_stagger', { enemyHealth: 200 });
const weaponId = state.player.equipment.weapon;
const weaponType = getEquippedWeaponType(state);
console.log('weapon ID:', weaponId);
console.log('weapon type detected:', weaponType);
