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
});
