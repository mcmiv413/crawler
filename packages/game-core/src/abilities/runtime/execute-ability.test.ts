/**
 * Test layer: unit
 * Behavior: Execute Ability covers executeAbility ring spell runtime; awards lightning XP and respects shock resistance when Bolt lands; applies storm_active and awards bot....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/abilities/runtime/execute-ability.test.ts
 */
import { describe, expect, it } from 'vitest';
import { entityId, type AbilityUsedEvent, type ItemTemplate } from '@dungeon/contracts';
import { createTestGameStateInCombat } from '../../test-utils.js';
import { executeAbility } from './execute-ability.js';
import { SeededRNG } from '../../utils/rng.js';

function createLearnedRingSpellState(abilityId: string, ringIds: readonly string[]) {
  const baseState = createTestGameStateInCombat();
  const items = new Map(baseState.itemRegistry.items);
  const equipment = { ...baseState.player.equipment };
  const ringMastery = { ...baseState.player.ringMastery };

  for (const [index, ringId] of ringIds.entries()) {
    const ringEntity = entityId(`${ringId}_${index + 1}`);
    const ringTemplate: ItemTemplate = {
      itemId: ringId,
      name: ringId,
      description: `${ringId} test fixture`,
      itemClass: 'relic',
      rarity: 'common',
      value: 0,
      stackable: false,
      maxStack: 1,
    };

    items.set(ringEntity, ringTemplate);
    if (index === 0) {
      equipment.ring1 = ringEntity;
    } else if (index === 1) {
      equipment.ring2 = ringEntity;
    }

    if (ringId === 'fire_ring') {
      ringMastery.fire = { xp: 0 };
    }
    if (ringId === 'lightning_ring') {
      ringMastery.lightning = { xp: 0 };
    }
  }

  return {
    ...baseState,
    itemRegistry: {
      ...baseState.itemRegistry,
      items,
    },
    player: {
      ...baseState.player,
      mana: 99,
      maxMana: 99,
      equipment,
      abilities: [{ id: abilityId, cooldownRemaining: 0 }],
      ringMastery,
      learnedRingSpellIds: [abilityId],
    },
  };
}

function findAbilityUsedEvent(
  events: readonly unknown[],
  abilityId: string,
): AbilityUsedEvent | undefined {
  return events.find(
    (event): event is AbilityUsedEvent =>
      typeof event === 'object'
      && event !== null
      && 'type' in event
      && event.type === 'ABILITY_USED'
      && 'abilityId' in event
      && event.abilityId === abilityId,
  );
}

describe('executeAbility ring spell runtime', () => {
  it('awards lightning XP and respects shock resistance when Bolt lands', () => {
    const baseState = createLearnedRingSpellState('bolt', ['lightning_ring']);
    const targetEnemy = [...baseState.run!.enemies.values()][0]!;
    const targetKey = `${targetEnemy.position.x},${targetEnemy.position.y}`;
    const shockResistantState = {
      ...baseState,
      run: {
        ...baseState.run!,
        enemies: new Map([
          [
            targetKey,
            {
              ...targetEnemy,
              affinities: {
                ...targetEnemy.affinities,
                shock: 0.9,
              },
            },
          ],
        ]),
      },
    };

    const baseResult = executeAbility(baseState, 'bolt', new SeededRNG(42), targetEnemy.id);
    const resistantResult = executeAbility(
      shockResistantState,
      'bolt',
      new SeededRNG(42),
      targetEnemy.id,
    );

    const baseAbilityEvent = findAbilityUsedEvent(baseResult.events, 'bolt');
    const resistantAbilityEvent = findAbilityUsedEvent(resistantResult.events, 'bolt');

    expect(baseAbilityEvent?.damage ?? 0).toBeGreaterThan(resistantAbilityEvent?.damage ?? 0);
    expect(baseResult.state.player.ringMastery.lightning?.xp ?? 0).toBeGreaterThan(
      baseState.player.ringMastery.lightning?.xp ?? 0,
    );
    expect(baseResult.state.player.ringMastery.fire?.xp ?? 0).toBe(
      baseState.player.ringMastery.fire?.xp ?? 0,
    );
  });

  it('applies storm_active and awards both schools XP when Thunderstorm is cast', () => {
    const state = createLearnedRingSpellState('thunderstorm', ['fire_ring', 'lightning_ring']);
    const initialFireXp = state.player.ringMastery.fire?.xp ?? 0;
    const initialLightningXp = state.player.ringMastery.lightning?.xp ?? 0;

    const result = executeAbility(state, 'thunderstorm', new SeededRNG(42));
    const thunderstormEvent = findAbilityUsedEvent(result.events, 'thunderstorm');
    const fireXp = result.state.player.ringMastery.fire?.xp ?? 0;
    const lightningXp = result.state.player.ringMastery.lightning?.xp ?? 0;

    expect(thunderstormEvent).toBeDefined();
    expect(result.state.player.statuses.some((status) => status.id === 'storm_active')).toBe(true);
    expect(fireXp).toBeGreaterThan(initialFireXp);
    expect(lightningXp - initialLightningXp).toBe(fireXp - initialFireXp);
  });

  describe('Slice 1: Ability execution rejection guardrails', () => {
    it('rejects ability with ABILITY_NOT_FOUND when definition is missing', () => {
      const state = createTestGameStateInCombat();
      const result = executeAbility(state, 'nonexistent_ability_xyz', new SeededRNG(42));

      expect(result.events.length).toBeGreaterThan(0);
      const rejectionEvent = result.events.find(
        (event): event is any =>
          typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
      );
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent?.reasonCode).toBe('ABILITY_NOT_FOUND');
      expect(result.state).toEqual(state);
      expect(result.runEnded).toBe(false);
    });

    it('rejects ability with INSUFFICIENT_MANA when player lacks mana', () => {
      const state = createLearnedRingSpellState('bolt', ['lightning_ring']);
      const lowManaState = {
        ...state,
        player: {
          ...state.player,
          mana: 1, // Not enough for any spell
          maxMana: 1,
        },
      };
      const targetEnemy = [...lowManaState.run!.enemies.values()][0]!;

      const result = executeAbility(lowManaState, 'bolt', new SeededRNG(42), targetEnemy.id);

      expect(result.events.length).toBeGreaterThan(0);
      const rejectionEvent = result.events.find(
        (event): event is any =>
          typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
      );
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent?.reasonCode).toBe('INSUFFICIENT_MANA');
      expect(result.state.player.mana).toBe(lowManaState.player.mana);
      expect(result.runEnded).toBe(false);
    });

    it('rejects ring spell with ABILITY_NOT_AVAILABLE when not equipped', () => {
      const state = createLearnedRingSpellState('thunderstorm', ['fire_ring', 'lightning_ring']);
      // Remove the rings from equipment to test the availability check
      const unequippedState = {
        ...state,
        player: {
          ...state.player,
          equipment: {
            ...state.player.equipment,
            ring1: null,
            ring2: null,
          },
        },
      };

      const result = executeAbility(unequippedState, 'thunderstorm', new SeededRNG(42));

      expect(result.events.length).toBeGreaterThan(0);
      const rejectionEvent = result.events.find(
        (event): event is any =>
          typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
      );
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent?.reasonCode).toBe('ABILITY_NOT_AVAILABLE');
      expect(result.state.player.mana).toBe(unequippedState.player.mana);
      expect(result.runEnded).toBe(false);
    });

    it('does not emit ABILITY_USED on rejected ability attempts', () => {
      const state = createTestGameStateInCombat();
      const result = executeAbility(state, 'nonexistent_ability_xyz', new SeededRNG(42));

      const abilityUsedEvent = result.events.find(
        (event): event is any =>
          typeof event === 'object' && event !== null && 'type' in event && event.type === 'ABILITY_USED',
      );
      expect(abilityUsedEvent).toBeUndefined();
    });

    it('does not spend mana on rejected ability attempts', () => {
      const state = createTestGameStateInCombat();
      const initialMana = state.player.mana;
      const result = executeAbility(state, 'nonexistent_ability_xyz', new SeededRNG(42));

      expect(result.state.player.mana).toBe(initialMana);
    });
  });
});
