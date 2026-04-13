import { createTestGameStateWithAbility } from './packages/game-core/dist/test-utils.js';
import { handleCommand } from './packages/game-core/dist/engine/command-handler.js';
import { SeededRNG } from './packages/game-core/dist/utils/rng.js';
import { entityId } from './packages/game-contracts/dist/index.js';

const state = createTestGameStateWithAbility('bludgeon_stagger', { enemyHealth: 200 });
const rng = new SeededRNG(1);
const enemies = state.run.enemies;
let targetId;
for (const enemy of enemies.values()) {
  targetId = enemy.id;
  break;
}

console.log('State player abilities:', state.player.abilities);
console.log('State player equipment:', state.player.equipment);
console.log('Target ID:', targetId);

const result = handleCommand(state, {
  type: 'USE_ABILITY',
  abilityId: 'bludgeon_stagger',
  targetId: entityId(targetId),
}, rng);

console.log('Result events:', result.events.map(e => ({ type: e.type, abilityId: e.abilityId })));
const abilityEvent = result.events.find(e => e.type === 'ABILITY_USED');
console.log('ABILITY_USED event found:', !!abilityEvent);
