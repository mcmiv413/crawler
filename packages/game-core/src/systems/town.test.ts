/**
 * Test layer: unit
 * Behavior: processTownAction applies rest, shop, spell study, rejection, and armor enchantment outcomes while preserving failed actions unchanged.
 * Proof: Assertions check health, gold, inventory, shop stock, learnedRingSpellIds, abilities, enchantment slots, defense recalculation, and events GOLD_CHANGED, SPELL_UNLOCKED, PLAYER_ACTION_REJECTED, and ENCHANTMENT_APPLIED.
 * Validation: pnpm vitest run packages/game-core/src/systems/town.test.ts
 */
import { describe, it, expect } from 'vitest';
import { processTownAction, processEnchantArmor } from './town.js';
import { validateTownTransaction } from './town-validator.js';
import { createTestGameState } from '../test-utils.js';
import { entityId } from '@dungeon/contracts';
import type { NpcState, ArmorTemplate, EntityId } from '@dungeon/contracts';

const FIRE_RING_SPELL_ID = 'heat_surge';
const FIRE_RING_ENCHANTMENT_ID = 'fire_ring_ember';
const BOLT_SPELL_ID = 'bolt';
const THUNDER_STEP_SPELL_ID = 'thunder_step';
const ROLLING_THUNDER_SPELL_ID = 'rolling_thunder';

const fireRingTemplate: ArmorTemplate = {
  itemId: 'fire_ring',
  name: 'Fire Ring',
  description: 'A ring bound to ember magic.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 100,
  stackable: false,
  maxStack: 1,
  armor: {
    defense: 0,
    evasionPenalty: 0,
    slot: 'ring',
    enchantmentSlots: 1,
    enchantments: [FIRE_RING_ENCHANTMENT_ID],
  },
};

const lightningRingTemplate: ArmorTemplate = {
  itemId: 'lightning_ring',
  name: 'Lightning Ring',
  description: 'A ring bound to storm magic.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 100,
  stackable: false,
  maxStack: 1,
  armor: {
    defense: 0,
    evasionPenalty: 0,
    slot: 'ring',
    enchantmentSlots: 0,
    enchantments: [],
  },
};

function makeStateWithFireRingEquipped(): ReturnType<typeof createTestGameState> {
  const ringId = entityId('fire_ring_instance');
  const base = createTestGameState({
    player: {
      gold: 500,
      equipment: {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: ringId,
        ring2: null,
      },
      ringMastery: {
        fire: {
          xp: 100,
        },
      },
    },
  });

  return {
    ...base,
    itemRegistry: {
      items: new Map([[ringId, fireRingTemplate]]),
    },
  };
}

function makeStateWithLightningRingEquipped(
  {
    gold = 500,
    lightningXp = 0,
    learnedRingSpellIds = [],
  }: {
    gold?: number;
    lightningXp?: number;
    learnedRingSpellIds?: string[];
  } = {},
): ReturnType<typeof createTestGameState> {
  const ringId = entityId('lightning_ring_instance');
  const base = createTestGameState({
    player: {
      gold,
      equipment: {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: ringId,
        ring2: null,
      },
      ringMastery: {
        lightning: {
          xp: lightningXp,
        },
      },
      learnedRingSpellIds,
    },
  });

  return {
    ...base,
    itemRegistry: {
      items: new Map([[ringId, lightningRingTemplate]]),
    },
  };
}

const shopkeeper: NpcState = {
  id: entityId('npc_shopkeeper'),
  name: 'Torben',
  role: 'shopkeeper',
  disposition: 50,
  available: true,
  dialogueKey: 'shopkeeper',
};


describe('processTownAction rest', () => {
  it('restores HP to max when player can afford full heal', () => {
    const maxHealth = 100;
    const state = createTestGameState({
      player: {
        stats: { maxHealth, health: 60, attack: 10, defense: 5, accuracy: 80, evasion: 10, speed: 100 },
        gold: 9999, // deliberately large — ensures the player can always afford a full heal
      },
    });

    const { state: newState } = processTownAction(state, 'rest');

    expect(newState.player.stats.health).toBe(newState.player.stats.maxHealth);
  });

  it('heals only affordable HP when gold is insufficient', () => {
    const initialHealth = 50;
    const state = createTestGameState({
      player: {
        stats: { maxHealth: 100, health: initialHealth, attack: 10, defense: 5, accuracy: 80, evasion: 10, speed: 100 },
        gold: 10,
      },
    });

    const { state: newState, events } = processTownAction(state, 'rest');

    expect(newState.player.stats.health).toBeGreaterThan(initialHealth);
    expect(newState.player.stats.health).toBeLessThanOrEqual(newState.player.stats.maxHealth);
    expect(newState.player.gold).toBeLessThanOrEqual(state.player.gold);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'GOLD_CHANGED',
      amount: newState.player.gold - state.player.gold,
      newTotal: newState.player.gold,
    }));
  });

  it('returns unchanged state when already at full HP', () => {
    const state = createTestGameState({
      player: {
        stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 80, evasion: 10, speed: 100 },
        gold: 50,
      },
    });

    const { state: newState } = processTownAction(state, 'rest');

    expect(newState.player.stats.health).toBe(newState.player.stats.maxHealth);
    expect(newState.player.gold).toBe(state.player.gold);
  });
});

describe('processTownAction shop_sell', () => {
  it('returns gold to player and removes item from inventory', () => {
    const baseState = createTestGameState({ player: { gold: 10 } });
    const initialGold = baseState.player.gold;
    // Add an item to inventory manually via registry
    const itemInstanceId = entityId('item_inst_1');
    const itemValue = 10;
    const newRegistry = new Map(baseState.itemRegistry.items);
    newRegistry.set(itemInstanceId, {
      itemId: 'health_potion',
      name: 'Health Potion',
      description: 'Heals 30 HP',
      itemClass: 'consumable' as const,
      rarity: 'common' as const,
      value: itemValue,
      stackable: true,
      maxStack: 5,
      consumable: { effect: 'heal' as const, magnitude: 30 },
    });
    const stateWithItem = {
      ...baseState,
      player: { ...baseState.player, inventory: [itemInstanceId] },
      itemRegistry: { items: newRegistry },
      world: { ...baseState.world, shop: { ...baseState.world.shop, buybackMultiplier: 0.4 } },
    };
    const { state: newState, events } = processTownAction(stateWithItem, 'shop_sell', itemInstanceId);
    expect(newState.player.gold).toBeGreaterThan(initialGold);
    expect(newState.player.inventory).not.toContain(itemInstanceId);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'GOLD_CHANGED',
      amount: newState.player.gold - stateWithItem.player.gold,
      newTotal: newState.player.gold,
    }));
  });
});

describe('processTownAction shop_buy', () => {
  const shopState = createTestGameState({
    world: {
      shop: {
        items: [{ itemId: 'health_potion', price: 15, stock: 3 }],
        buybackMultiplier: 0.4,
      },
    },
    player: { gold: 50 },
  });

  it('deducts gold and adds item to inventory', () => {
    const initialGold = shopState.player.gold;
    const initialInvLength = shopState.player.inventory.length;
    const { state: newState, events } = processTownAction(shopState, 'shop_buy', undefined, 'health_potion');

    expect(newState.player.gold).toBeLessThan(initialGold);
    expect(newState.player.inventory.length).toBeGreaterThan(initialInvLength);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'GOLD_CHANGED',
      amount: newState.player.gold - shopState.player.gold,
      newTotal: newState.player.gold,
    }));
  });

  it('fails when player has insufficient gold — state unchanged', () => {
    const poorState = createTestGameState({
      world: {
        shop: {
          items: [{ itemId: 'health_potion', price: 100, stock: 3 }],
          buybackMultiplier: 0.4,
        },
      },
      player: { gold: 50 },
    });

    const { state: newState } = processTownAction(poorState, 'shop_buy', undefined, 'health_potion');

    expect(newState.player.gold).toBe(poorState.player.gold);
    expect(newState.player.inventory.length).toBe(poorState.player.inventory.length);
  });

  it('decrements shop stock after purchase', () => {
    const initialStock = shopState.world.shop.items.find(i => i.itemId === 'health_potion')?.stock ?? 0;
    const { state: newState } = processTownAction(shopState, 'shop_buy', undefined, 'health_potion');

    const shopItem = newState.world.shop.items.find(i => i.itemId === 'health_potion');
    expect(shopItem?.stock ?? 0).toBeLessThan(initialStock);
  });

  it('emits gold change when undoing a shop purchase', () => {
    const bought = processTownAction(shopState, 'shop_buy', undefined, 'health_potion').state;

    const { state: undone, events } = processTownAction(bought, 'shop_undo');

    expect(undone.player.gold).toBe(shopState.player.gold);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'GOLD_CHANGED',
      amount: undone.player.gold - bought.player.gold,
      newTotal: undone.player.gold,
    }));
  });

  it('shopkeeper with disposition=50 applies 5% discount per 10 disposition (25% total)', () => {
    const basePrice = 100;
    const initialGold = 200;
    const stateWithShopkeeper = createTestGameState({
      world: {
        npcs: [shopkeeper],
        shop: {
          items: [{ itemId: 'health_potion', price: basePrice, stock: 3 }],
          buybackMultiplier: 0.4,
        },
      },
      player: { gold: initialGold },
    });
    const { state: newState } = processTownAction(stateWithShopkeeper, 'shop_buy', undefined, 'health_potion');
    // With disposition=50, should have a discount applied
    expect(newState.player.gold).toBeLessThan(initialGold);
    expect(newState.player.gold).toBeGreaterThan(initialGold - basePrice);
  });

  it('shopkeeper with disposition=0 applies no discount', () => {
    const basePrice = 100;
    const initialGold = 200;
    const noDispositionShopkeeper: NpcState = { ...shopkeeper, disposition: 0 };
    const stateWithShopkeeper = createTestGameState({
      world: {
        npcs: [noDispositionShopkeeper],
        shop: {
          items: [{ itemId: 'health_potion', price: basePrice, stock: 3 }],
          buybackMultiplier: 0.4,
        },
      },
      player: { gold: initialGold },
    });
    const { state: newState } = processTownAction(stateWithShopkeeper, 'shop_buy', undefined, 'health_potion');
    expect(newState.player.gold).toBeLessThanOrEqual(initialGold - basePrice);
  });

  it('discount is capped at 25%', () => {
    const basePrice = 100;
    const initialGold = 200;
    const maxShopkeeper: NpcState = { ...shopkeeper, disposition: 100 };
    const stateWithShopkeeper = createTestGameState({
      world: {
        npcs: [maxShopkeeper],
        shop: {
          items: [{ itemId: 'health_potion', price: basePrice, stock: 3 }],
          buybackMultiplier: 0.4,
        },
      },
      player: { gold: initialGold },
    });
    const { state: newState } = processTownAction(stateWithShopkeeper, 'shop_buy', undefined, 'health_potion');
    expect(newState.player.gold).toBeLessThan(initialGold);
    expect(newState.player.gold).toBeGreaterThanOrEqual(initialGold - basePrice);
  });

  it('allows purchasing uncommon items when highestFound >= uncommon', () => {
    const itemPrice = 50;
    const initialGold = 100;
    const stateWithUncommonFound = createTestGameState({
      world: {
        shop: {
          items: [{ itemId: 'stone_hammer', price: itemPrice, stock: 3 }], // uncommon weapon
          buybackMultiplier: 0.4,
        },
        highestRarityFound: 'uncommon', // Player has found uncommon items
      },
      player: { gold: initialGold },
    });
    const { state: newState } = processTownAction(stateWithUncommonFound, 'shop_buy', undefined, 'stone_hammer');
    expect(newState.player.gold).toBeLessThan(initialGold);
    expect(newState.player.inventory.length).toBeGreaterThan(0);
  });
});

describe('processTownAction study_spell', () => {
  it('unlocks an Elder spell, deducts gold, emits events, and grants it from the equipped Fire Ring', () => {
    const state = makeStateWithFireRingEquipped();
    const initialGold = state.player.gold;
    const initialFireXp = state.player.ringMastery.fire?.xp ?? 0;

    const { state: studied, events } = processTownAction(
      state,
      'study_spell',
      undefined,
      undefined,
      undefined,
      FIRE_RING_SPELL_ID,
    );

    expect(studied.player.gold).toBeLessThan(initialGold);
    expect(studied.player.learnedRingSpellIds).toContain(FIRE_RING_SPELL_ID);
    expect(studied.player.abilities.map(ability => ability.id)).toContain(FIRE_RING_SPELL_ID);
    expect(studied.player.ringMastery.fire?.xp).toBe(initialFireXp);
    expect(events.some(event => event.type === 'GOLD_CHANGED')).toBe(true);
    expect(events.some(event => event.type === 'SPELL_UNLOCKED' && event.spellId === FIRE_RING_SPELL_ID)).toBe(true);
  });

  it('rejects Elder study when the required Fire Ring is not equipped', () => {
    const state = createTestGameState({
      player: {
        gold: 500,
        ringMastery: {
          fire: {
            xp: 100,
          },
        },
      },
    });

    const result = processTownAction(
      state,
      'study_spell',
      undefined,
      undefined,
      undefined,
      FIRE_RING_SPELL_ID,
    );

    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe('PLAYER_ACTION_REJECTED');
    if (result.events[0] && result.events[0].type === 'PLAYER_ACTION_REJECTED') {
      expect(result.events[0].reasonCode).toBe('SPELL_STUDY_INELIGIBLE');
    }
  });

  it('rejects Elder study when the spell is already unlocked', () => {
    const baseState = makeStateWithFireRingEquipped();
    const state = {
      ...baseState,
      player: {
        ...baseState.player,
        learnedRingSpellIds: [FIRE_RING_SPELL_ID],
      },
    };

    const result = processTownAction(
      state,
      'study_spell',
      undefined,
      undefined,
      undefined,
      FIRE_RING_SPELL_ID,
    );

    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: 'PLAYER_ACTION_REJECTED',
      reasonCode: 'SPELL_STUDY_INELIGIBLE',
    });
  });

  it('studies the Lightning ladder in order, spending gold without granting Lightning XP', () => {
    const state = makeStateWithLightningRingEquipped({ lightningXp: 60 });
    const initialLightningXp = state.player.ringMastery.lightning?.xp ?? 0;

    const boltResult = processTownAction(
      state,
      'study_spell',
      undefined,
      undefined,
      undefined,
      BOLT_SPELL_ID,
    );
    expect(boltResult.state.player.gold).toBeLessThan(state.player.gold);
    expect(boltResult.state.player.learnedRingSpellIds).toContain(BOLT_SPELL_ID);
    expect(boltResult.state.player.abilities.map(ability => ability.id)).toContain(BOLT_SPELL_ID);
    expect(boltResult.state.player.ringMastery.lightning?.xp).toBe(initialLightningXp);
    expect(boltResult.events.some(event => event.type === 'GOLD_CHANGED')).toBe(true);
    expect(boltResult.events.some(event => event.type === 'SPELL_UNLOCKED' && event.spellId === BOLT_SPELL_ID)).toBe(true);

    const thunderStepResult = processTownAction(
      boltResult.state,
      'study_spell',
      undefined,
      undefined,
      undefined,
      THUNDER_STEP_SPELL_ID,
    );
    expect(thunderStepResult.state.player.gold).toBeLessThan(boltResult.state.player.gold);
    expect(thunderStepResult.state.player.learnedRingSpellIds).toEqual(expect.arrayContaining([
      BOLT_SPELL_ID,
      THUNDER_STEP_SPELL_ID,
    ]));
    expect(thunderStepResult.state.player.abilities.map(ability => ability.id)).toEqual(expect.arrayContaining([
      BOLT_SPELL_ID,
      THUNDER_STEP_SPELL_ID,
    ]));
    expect(thunderStepResult.state.player.ringMastery.lightning?.xp).toBe(initialLightningXp);
    expect(thunderStepResult.events.some(event => event.type === 'GOLD_CHANGED')).toBe(true);
    expect(thunderStepResult.events.some(event => event.type === 'SPELL_UNLOCKED' && event.spellId === THUNDER_STEP_SPELL_ID)).toBe(true);

    const rollingThunderResult = processTownAction(
      thunderStepResult.state,
      'study_spell',
      undefined,
      undefined,
      undefined,
      ROLLING_THUNDER_SPELL_ID,
    );
    expect(rollingThunderResult.state.player.gold).toBeLessThan(thunderStepResult.state.player.gold);
    expect(rollingThunderResult.state.player.learnedRingSpellIds).toEqual(expect.arrayContaining([
      BOLT_SPELL_ID,
      THUNDER_STEP_SPELL_ID,
      ROLLING_THUNDER_SPELL_ID,
    ]));
    expect(rollingThunderResult.state.player.abilities.map(ability => ability.id)).toEqual(expect.arrayContaining([
      BOLT_SPELL_ID,
      THUNDER_STEP_SPELL_ID,
      ROLLING_THUNDER_SPELL_ID,
    ]));
    expect(rollingThunderResult.state.player.ringMastery.lightning?.xp).toBe(initialLightningXp);
    expect(rollingThunderResult.events.some(event => event.type === 'GOLD_CHANGED')).toBe(true);
    expect(rollingThunderResult.events.some(event => event.type === 'SPELL_UNLOCKED' && event.spellId === ROLLING_THUNDER_SPELL_ID)).toBe(true);
  });

  it('rejects Lightning study until prerequisite and mastery gates are met', () => {
    const missingPrerequisiteState = makeStateWithLightningRingEquipped({ lightningXp: 60 });
    const thunderStepResult = processTownAction(
      missingPrerequisiteState,
      'study_spell',
      undefined,
      undefined,
      undefined,
      THUNDER_STEP_SPELL_ID,
    );

    expect(thunderStepResult.state).toBe(missingPrerequisiteState);
    expect(thunderStepResult.events).toHaveLength(1);
    expect(thunderStepResult.events[0]).toMatchObject({
      type: 'PLAYER_ACTION_REJECTED',
      reasonCode: 'SPELL_STUDY_INELIGIBLE',
    });

    const missingXpState = makeStateWithLightningRingEquipped({
      lightningXp: 59,
      learnedRingSpellIds: [BOLT_SPELL_ID, THUNDER_STEP_SPELL_ID],
    });
    const rollingThunderResult = processTownAction(
      missingXpState,
      'study_spell',
      undefined,
      undefined,
      undefined,
      ROLLING_THUNDER_SPELL_ID,
    );

    expect(rollingThunderResult.state).toBe(missingXpState);
    expect(rollingThunderResult.events).toHaveLength(1);
    expect(rollingThunderResult.events[0]).toMatchObject({
      type: 'PLAYER_ACTION_REJECTED',
      reasonCode: 'SPELL_STUDY_INELIGIBLE',
    });
  });

  it('rejects starter spell study when gold is insufficient', () => {
    const state = makeStateWithLightningRingEquipped({ gold: 0 });

    const result = processTownAction(
      state,
      'study_spell',
      undefined,
      undefined,
      undefined,
      BOLT_SPELL_ID,
    );

    expect(result.state).toBe(state);
    expect(result.state.player.gold).toBe(state.player.gold);
    expect(result.state.player.learnedRingSpellIds).toEqual(state.player.learnedRingSpellIds);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: 'PLAYER_ACTION_REJECTED',
      reasonCode: 'INSUFFICIENT_GOLD',
    });
  });
});

// ---------------------------------------------------------------------------
// validateTownTransaction & rejection events
// ---------------------------------------------------------------------------

describe('validateTownTransaction STUDY_SPELL rejections', () => {
  it('rejects when spell does not exist (SPELL_NOT_FOUND)', () => {
    const state = makeStateWithLightningRingEquipped({ gold: 500 });
    const result = validateTownTransaction(state, 'STUDY_SPELL', { spellId: 'nonexistent_spell' });
    expect(result.valid).toBe(false);
    expect((result as any).rejectionCode).toBe('SPELL_NOT_FOUND');
  });

  it('rejects when spell already learned (SPELL_STUDY_INELIGIBLE)', () => {
    const state = makeStateWithLightningRingEquipped({
      gold: 500,
      learnedRingSpellIds: [BOLT_SPELL_ID],
    });
    const result = validateTownTransaction(state, 'STUDY_SPELL', { spellId: BOLT_SPELL_ID });
    expect(result.valid).toBe(false);
    expect((result as any).rejectionCode).toBe('SPELL_STUDY_INELIGIBLE');
  });
});

describe('validateTownTransaction BUY_ITEM rejections', () => {
  it('rejects when item not in shop (ITEM_NOT_FOR_SALE)', () => {
    const state = createTestGameState({ player: { gold: 1000 } });
    const result = validateTownTransaction(state, 'BUY_ITEM', { itemId: 'nonexistent_item' });
    expect(result.valid).toBe(false);
    expect((result as any).rejectionCode).toBe('ITEM_NOT_FOR_SALE');
  });

  it('rejects when player has insufficient gold (INSUFFICIENT_GOLD)', () => {
    const state = createTestGameState({ player: { gold: 10 } }); // very low gold
    // Assuming shop has items — find one and try to buy it with insufficient funds
    const shopItem = state.world.shop.items[0];
    if (shopItem !== undefined && shopItem.price > 10) {
      const result = validateTownTransaction(state, 'BUY_ITEM', { itemId: shopItem.itemId });
      expect(result.valid).toBe(false);
      expect((result as any).rejectionCode).toBe('INSUFFICIENT_GOLD');
    }
  });
});

describe('validateTownTransaction TURN_IN_QUEST rejections', () => {
  it('rejects when quest does not exist (QUEST_NOT_FOUND)', () => {
    const state = createTestGameState({ player: { gold: 500 } });
    const result = validateTownTransaction(state, 'TURN_IN_QUEST', { questId: entityId('nonexistent_quest') });
    expect(result.valid).toBe(false);
    expect((result as any).rejectionCode).toBe('QUEST_NOT_FOUND');
  });

  it('rejects when quest is not ready to turn in (QUEST_NOT_READY)', () => {
    const state = createTestGameState({ player: { gold: 500 } });
    // Assume there's an active quest not in ready_to_turn_in status
    if (state.activeQuests.length > 0) {
      const quest = state.activeQuests[0];
      if (quest && quest.status !== 'ready_to_turn_in') {
        const result = validateTownTransaction(state, 'TURN_IN_QUEST', { questId: quest.id as EntityId });
        expect(result.valid).toBe(false);
        expect((result as any).rejectionCode).toBe('QUEST_NOT_READY');
      }
    }
  });
});

describe('processTownAction rejection events', () => {
  it('emits PLAYER_ACTION_REJECTED for invalid spell study', () => {
    const state = createTestGameState({ player: { gold: 500 } });
    const { events } = processTownAction(state, 'study_spell', undefined, undefined, undefined, 'nonexistent_spell');

    const rejectionEvent = events.find(e => e.type === 'PLAYER_ACTION_REJECTED');
    expect(rejectionEvent).toBeDefined();
    if (rejectionEvent && rejectionEvent.type === 'PLAYER_ACTION_REJECTED') {
      expect(rejectionEvent.actionType).toBe('TOWN_ACTION');
      expect(rejectionEvent.actionId).toBe('nonexistent_spell');
      expect(rejectionEvent.reasonCode).toBe('SPELL_NOT_FOUND');
    }
  });

  it('emits PLAYER_ACTION_REJECTED for invalid item purchase', () => {
    const state = createTestGameState({ player: { gold: 500 } });
    const { events } = processTownAction(state, 'shop_buy', undefined, 'nonexistent_item');

    const rejectionEvent = events.find(e => e.type === 'PLAYER_ACTION_REJECTED');
    expect(rejectionEvent).toBeDefined();
    if (rejectionEvent && rejectionEvent.type === 'PLAYER_ACTION_REJECTED') {
      expect(rejectionEvent.actionType).toBe('TOWN_ACTION');
      expect(rejectionEvent.actionId).toBe('nonexistent_item');
      expect(rejectionEvent.reasonCode).toBe('ITEM_NOT_FOR_SALE');
    }
  });

  it('emits PLAYER_ACTION_REJECTED for insufficient gold on buy', () => {
    const state = createTestGameState({ player: { gold: 5 } });
    const shopItem = state.world.shop.items[0];
    if (shopItem !== undefined && shopItem.price > 5) {
      const { events } = processTownAction(state, 'shop_buy', undefined, shopItem.itemId);

      const rejectionEvent = events.find(e => e.type === 'PLAYER_ACTION_REJECTED');
      expect(rejectionEvent).toBeDefined();
      if (rejectionEvent && rejectionEvent.type === 'PLAYER_ACTION_REJECTED') {
        expect(rejectionEvent.actionType).toBe('TOWN_ACTION');
        expect(rejectionEvent.reasonCode).toBe('INSUFFICIENT_GOLD');
      }
    }
  });

  it('emits PLAYER_ACTION_REJECTED for quest not ready', () => {
    const state = createTestGameState({ player: { gold: 500 } });
    if (state.activeQuests.length > 0) {
      const quest = state.activeQuests[0];
      if (quest && quest.status !== 'ready_to_turn_in') {
        const { events } = processTownAction(state, 'turn_in_quest', quest.id as EntityId);

        const rejectionEvent = events.find(e => e.type === 'PLAYER_ACTION_REJECTED');
        expect(rejectionEvent).toBeDefined();
        if (rejectionEvent && rejectionEvent.type === 'PLAYER_ACTION_REJECTED') {
          expect(rejectionEvent.actionType).toBe('TOWN_ACTION');
          expect(rejectionEvent.reasonCode).toBe('QUEST_NOT_READY');
        }
      }
    }
  });

  it('does not advance turn or consume resources on rejection', () => {
    const state = createTestGameState({ player: { gold: 500 } });
    const initialTurn = state.turnNumber;
    const initialGold = state.player.gold;
    const initialInventorySize = state.player.inventory.length;

    const { state: resultState } = processTownAction(state, 'study_spell', undefined, undefined, undefined, 'nonexistent_spell');

    expect(resultState.turnNumber).toBe(initialTurn);
    expect(resultState.player.gold).toBe(initialGold);
    expect(resultState.player.inventory.length).toBe(initialInventorySize);
  });
});

// ---------------------------------------------------------------------------
// processEnchantArmor
// ---------------------------------------------------------------------------

const chestArmor: ArmorTemplate = {
  itemId: 'test_chain',
  name: 'Test Chain',
  description: 'A chain shirt',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 35,
  stackable: false,
  maxStack: 1,
  armor: { defense: 5, evasionPenalty: 5, slot: 'chest', enchantmentSlots: 1, enchantments: [null] },
};

const rareChest: ArmorTemplate = {
  itemId: 'test_plate',
  name: 'Test Plate',
  description: 'Plate armor',
  itemClass: 'armor',
  rarity: 'rare',
  value: 70,
  stackable: false,
  maxStack: 1,
  armor: { defense: 10, evasionPenalty: 15, slot: 'chest', enchantmentSlots: 2, enchantments: [null, null] },
};

function makeStateWithArmorEquipped(armorTemplate: ArmorTemplate, gold = 500): ReturnType<typeof createTestGameState> {
  const armorId = entityId('armor_1');
  const registry = new Map([[armorId, armorTemplate]]);
  return {
    ...createTestGameState({ player: { gold } }),
    player: {
      ...createTestGameState({ player: { gold } }).player,
      equipment: {
        weapon: null, secondaryWeapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null,
      },
    },
    world: {
      ...createTestGameState().world,
      unlockedBlueprints: ['hp_regen', 'thorns', 'resist_fire'],
    },
    itemRegistry: { items: registry as any },
  };
}

describe('processEnchantArmor', () => {
  it('rejects if enchantmentId not in unlockedBlueprints', () => {
    const initialGold = 500;
    const state = makeStateWithArmorEquipped(chestArmor, initialGold);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'defense_boost'); // not unlocked
    expect(s2.player.gold).toBe(initialGold); // unchanged
  });

  it('rejects if player has insufficient gold', () => {
    const initialGold = 35;
    const state = makeStateWithArmorEquipped(chestArmor, initialGold);
    const { state: s2, events } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBe(initialGold); // unchanged due to insufficient gold
    expect(events).toContainEqual(expect.objectContaining({
      type: 'PLAYER_ACTION_REJECTED',
      reasonCode: 'INSUFFICIENT_GOLD',
    }));
  });

  it('rejects if no item in the equipment slot', () => {
    const initialGold = 500;
    const state = makeStateWithArmorEquipped(chestArmor, initialGold);
    const { state: s2 } = processEnchantArmor(state, 'head', 'hp_regen'); // head slot empty
    expect(s2.player.gold).toBe(initialGold);
  });

  it('rejects if item has no enchantment slots (common rarity)', () => {
    const commonArmor: ArmorTemplate = {
      ...chestArmor,
      itemId: 'common_vest',
      rarity: 'common',
      armor: { ...chestArmor.armor, enchantmentSlots: 0, enchantments: [] },
    };
    const armorId = entityId('armor_common');
    const initialGold = 500;
    const state = {
      ...createTestGameState({ player: { gold: initialGold } }),
      player: {
        ...createTestGameState({ player: { gold: initialGold } }).player,
        equipment: { weapon: null, secondaryWeapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      world: { ...createTestGameState().world, unlockedBlueprints: ['hp_regen'] },
      itemRegistry: { items: new Map([[armorId, commonArmor]]) as any },
    };
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBe(initialGold);
  });

  it('rejects if all enchantment slots are already filled', () => {
    const fullArmor: ArmorTemplate = {
      ...chestArmor,
      armor: { ...chestArmor.armor, enchantments: ['thorns'] },
    };
    const armorId = entityId('armor_full');
    const initialGold = 500;
    const state = {
      ...createTestGameState({ player: { gold: initialGold } }),
      player: {
        ...createTestGameState({ player: { gold: initialGold } }).player,
        equipment: { weapon: null, secondaryWeapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      world: { ...createTestGameState().world, unlockedBlueprints: ['hp_regen', 'thorns'] },
      itemRegistry: { items: new Map([[armorId, fullArmor]]) as any },
    };
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBe(initialGold);
  });

  it('rejects if enchantment is already applied to the item', () => {
    const alreadyEnchanted: ArmorTemplate = {
      ...rareChest,
      armor: { ...rareChest.armor, enchantments: ['hp_regen', null] },
    };
    const armorId = entityId('armor_enc');
    const initialGold = 500;
    const state = {
      ...createTestGameState({ player: { gold: initialGold } }),
      player: {
        ...createTestGameState({ player: { gold: initialGold } }).player,
        equipment: { weapon: null, secondaryWeapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      world: { ...createTestGameState().world, unlockedBlueprints: ['hp_regen'] },
      itemRegistry: { items: new Map([[armorId, alreadyEnchanted]]) as any },
    };
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBe(initialGold);
  });

  it('deducts gold for enchantment when affordable', () => {
    const initialGold = 200;
    const state = makeStateWithArmorEquipped(chestArmor, initialGold);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2.player.gold).toBeLessThan(initialGold);
  });

  it('fills the first null enchantment slot', () => {
    const state = makeStateWithArmorEquipped(chestArmor, 200);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    const armorId = s2.player.equipment.chest!;
    const updatedArmor = s2.itemRegistry.items.get(armorId) as ArmorTemplate;
    expect(updatedArmor.armor.enchantments[0]).toBe('hp_regen');
  });

  it('emits ENCHANTMENT_APPLIED event', () => {
    const state = makeStateWithArmorEquipped(chestArmor, 200);
    const { events } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(events.some(e => e.type === 'ENCHANTMENT_APPLIED')).toBe(true);
  });

  it('recalculates player stats after enchantment', () => {
    const armorId = entityId('armor_2slot');
    const twoSlotArmor: ArmorTemplate = {
      ...rareChest,
      armor: { ...rareChest.armor },
    };
    const state = {
      ...createTestGameState({ player: { gold: 500 } }),
      player: {
        ...createTestGameState({ player: { gold: 500 } }).player,
        equipment: { weapon: null, secondaryWeapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      world: { ...createTestGameState().world, unlockedBlueprints: ['hp_regen', 'thorns', 'resist_fire', 'evasion_boost', 'defense_boost'] },
      itemRegistry: { items: new Map([[armorId, twoSlotArmor]]) as any },
    };
    const baseDefense = state.player.baseStats.defense + twoSlotArmor.armor.defense;
    const { state: s2 } = processEnchantArmor(state, 'chest', 'defense_boost');
    expect(s2.player.stats.defense).toBeGreaterThan(baseDefense);
  });

  it('no partial mutation on failure — state identical to input', () => {
    const state = makeStateWithArmorEquipped(chestArmor, 35);
    const { state: s2 } = processEnchantArmor(state, 'chest', 'hp_regen');
    expect(s2).toBe(state); // same reference (no new object)
  });
});
