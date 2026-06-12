import { describe, expect, it } from 'vitest';
import { entityId } from '@dungeon/contracts';
import type { AbilityContext } from '../types.js';
import { createTestGameStateInCombat } from '../../test-utils.js';
import { SeededRNG } from '../../utils/rng.js';
import { buildAbilityUsedEvent } from './emit-events.js';

function makeContext(): AbilityContext {
  const state = createTestGameStateInCombat();
  return {
    state,
    rng: new SeededRNG(1),
    player: state.player,
    run: state.run,
    equippedWeaponId: state.player.equipment.weapon,
    direction: undefined,
    target: undefined,
    targetPosition: undefined,
  };
}

describe('buildAbilityUsedEvent', () => {
  it('includes hit false for missed attack ability results', () => {
    const [event] = buildAbilityUsedEvent(makeContext(), 'ember', 'Ember', {
      targetId: entityId('enemy-1'),
      targetName: 'Training Target',
      hit: false,
      damage: 0,
    });

    expect(event).toMatchObject({
      type: 'ABILITY_USED',
      abilityId: 'ember',
      abilityName: 'Ember',
      targetName: 'Training Target',
      hit: false,
      damage: 0,
    });
  });

  it('defaults hit true when the result does not specify a hit value', () => {
    const [event] = buildAbilityUsedEvent(makeContext(), 'second_wind', 'Second Wind', {
      healAmount: 10,
    });

    expect(event).toMatchObject({
      type: 'ABILITY_USED',
      abilityId: 'second_wind',
      hit: true,
      healAmount: 10,
    });
  });
});
