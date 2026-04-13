import { createTestGameStateWithAbility } from './packages/game-core/dist/test-utils.js';
import { handleCommand } from './packages/game-core/dist/engine/command-handler.js';
import { SeededRNG } from './packages/game-core/dist/utils/rng.js';
import { entityId } from './packages/game-contracts/dist/index.js';

const state = createTestGameStateWithAbility('bludgeon_stagger', { enemyHealth: 200 });
console.log('[TEST] State created for bludgeon_stagger');
console.log('[TEST] Player weapon:', state.player.equipment.weapon);
console.log('[TEST] Player abilities:', state.player.abilities);

const enemies = state.run.enemies;
let targetId;
for (const enemy of enemies.values()) {
  targetId = enemy.id;
  break;
}

const rng = new SeededRNG(1);
const result = handleCommand(state, {
  type: 'USE_ABILITY',
  abilityId: 'bludgeon_stagger',
  targetId: entityId(targetId),
}, rng);

console.log('[TEST] Events returned:', result.events.length);
console.log('[TEST] Event types:', result.events.map(e => e.type));
const abilityEvent = result.events.find(e => e.type === 'ABILITY_USED');
console.log('[TEST] ABILITY_USED event found:', !!abilityEvent);
