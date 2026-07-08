/**
 * Test layer: unit
 * Behavior: Inventory View Builder covers buildInventoryView; basic inventory structure; returns InventoryView with items and equipped slots.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/presenter/src/builders/inventory-view-builder.test.ts
 */
import { buildInventoryView } from './inventory-view-builder.js';
import { entityId } from '@dungeon/contracts';
import type { EntityId, GameState, ItemRegistry } from '@dungeon/contracts';
import { createTestGameState } from '@dungeon/core/testing';

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createTestGameState({
    player: overrides.player as any,
    phase: overrides.phase as any,
    world: overrides.world as any,
  });
  return {
    ...base,
    ...overrides,
    // Merge player separately to preserve nested properties
    player: { ...base.player, ...overrides.player },
    // Merge world separately
    world: { ...base.world, ...overrides.world },
  };
}

function makeItemRegistry(items: Record<string, any>): ItemRegistry {
  const registry = new Map<EntityId, any>();
  for (const [id, template] of Object.entries(items)) {
    registry.set(entityId(id), template);
  }
  return { items: registry };
}

describe('buildInventoryView', () => {
  describe('basic inventory structure', () => {
    it('returns InventoryView with items and equipped slots', () => {
      const state = makeState();
      const view = buildInventoryView(state);

      expect(view).toHaveProperty('items');
      expect(view).toHaveProperty('equipped');
      expect(Array.isArray(view.items)).toBe(true);
    });

    it('handles empty inventory', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [],
        },
      });
      const view = buildInventoryView(state);

      expect(view.items).toHaveLength(0);
    });

    it('includes items from player inventory', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('potion1')],
        },
        itemRegistry: makeItemRegistry({
          potion1: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals 30 HP',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: false,
            spriteName: 'potion_green',
          },
        }),
      });
      const view = buildInventoryView(state);

      expect(view.items.length).toBeGreaterThan(0);
      const item = view.items.find(i => i.id === entityId('potion1'));
      expect(item).toBeDefined();
      expect(item?.name).toBe('Health Potion');
    });
  });

  describe('equipment sorting', () => {
    it('sorts equipped items before unequipped items', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('potion1')],
          equipment: {
            weapon: entityId('sword1'),
            secondaryWeapon: null,
            chest: null,
            head: null,
            gloves: null,
            boots: null,
            ring1: null,
            ring2: null,
          },
        },
        itemRegistry: makeItemRegistry({
          sword1: {
            itemId: 'iron_sword',
            name: 'Iron Sword',
            description: 'A sword',
            itemClass: 'weapon',
            rarity: 'common',
            value: 50,
            stackable: false,
            spriteName: 'sword_iron',
            weapon: { damage: 8, damageType: 'physical', accuracy: 75, speed: 100, weaponRange: 1, minRange: 0 },
          },
          potion1: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: false,
            spriteName: 'potion_green',
          },
        }),
      });

      const view = buildInventoryView(state);
      const equippedIdx = view.items.findIndex(i => i.isEquipped);
      const unequippedIdx = view.items.findIndex(i => !i.isEquipped);

      expect(equippedIdx).toBeLessThan(unequippedIdx);
    });

    it('maintains separate entries for equipped-only items not in inventory', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [],
          equipment: {
            weapon: entityId('sword1'),
            secondaryWeapon: null,
            chest: null,
            head: null,
            gloves: null,
            boots: null,
            ring1: null,
            ring2: null,
          },
        },
        itemRegistry: makeItemRegistry({
          sword1: {
            itemId: 'iron_sword',
            name: 'Iron Sword',
            description: 'A sword',
            itemClass: 'weapon',
            rarity: 'common',
            value: 50,
            stackable: false,
            spriteName: 'sword_iron',
            weapon: { damage: 8, damageType: 'physical', accuracy: 75, speed: 100, weaponRange: 1, minRange: 0 },
          },
        }),
      });

      const view = buildInventoryView(state);
      expect(view.items).toHaveLength(1);
      expect(view.items[0]?.isEquipped).toBe(true);
    });
  });

  describe('item stacking', () => {
    it('groups stackable items with same templateId into single entry', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('p1'), entityId('p2'), entityId('p3')],
        },
        itemRegistry: makeItemRegistry({
          p1: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
          p2: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
          p3: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
        }),
      });

      const view = buildInventoryView(state);
      const potions = view.items.filter(i => i.templateId === 'health_potion');

      expect(potions).toHaveLength(1);
      expect(potions[0]?.quantity).toBe(3);
    });

    it('keeps non-stackable items separate', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('s1'), entityId('s2')],
        },
        itemRegistry: makeItemRegistry({
          s1: {
            itemId: 'iron_sword',
            name: 'Iron Sword',
            description: 'A sword',
            itemClass: 'weapon',
            rarity: 'common',
            value: 50,
            stackable: false,
            maxStack: 1,
            spriteName: 'sword_iron',
            weapon: { damage: 8, damageType: 'physical', accuracy: 75, speed: 100, weaponRange: 1, minRange: 0 },
          },
          s2: {
            itemId: 'iron_sword',
            name: 'Iron Sword',
            description: 'A sword',
            itemClass: 'weapon',
            rarity: 'common',
            value: 50,
            stackable: false,
            maxStack: 1,
            spriteName: 'sword_iron',
            weapon: { damage: 8, damageType: 'physical', accuracy: 75, speed: 100, weaponRange: 1, minRange: 0 },
          },
        }),
      });

      const view = buildInventoryView(state);
      const swords = view.items.filter(i => i.templateId === 'iron_sword');

      expect(swords).toHaveLength(2);
      expect(swords.every(s => s.quantity === 1)).toBe(true);
    });

    it('never stacks equipped items', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('p1')],
          equipment: {
            weapon: entityId('p2'),
            secondaryWeapon: null,
            chest: null,
            head: null,
            gloves: null,
            boots: null,
            ring1: null,
            ring2: null,
          },
        },
        itemRegistry: makeItemRegistry({
          p1: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
          p2: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
        }),
      });

      const view = buildInventoryView(state);
      // Should have 2 entries: 1 stacked (unequipped) and 1 equipped (not stacked)
      expect(view.items).toHaveLength(2);
      const equipped = view.items.filter(i => i.isEquipped);
      expect(equipped[0]?.quantity).toBe(1);
    });

    it('stackEntityIds contains all EntityIds in the stack', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('p1'), entityId('p2'), entityId('p3')],
        },
        itemRegistry: makeItemRegistry({
          p1: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
          p2: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
          p3: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
        }),
      });

      const view = buildInventoryView(state);
      const stack = view.items[0]!;

      expect(stack.stackEntityIds).toHaveLength(3);
      expect(stack.stackEntityIds).toContain(entityId('p1'));
      expect(stack.stackEntityIds).toContain(entityId('p2'));
      expect(stack.stackEntityIds).toContain(entityId('p3'));
    });
  });

  describe('item properties', () => {
    it('includes a rarity color for rare items', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('rare_sword')],
        },
        itemRegistry: makeItemRegistry({
          rare_sword: {
            itemId: 'steel_sword',
            name: 'Steel Sword',
            description: 'A steel sword',
            itemClass: 'weapon',
            rarity: 'rare',
            value: 100,
            stackable: false,
            spriteName: 'sword_steel',
            weapon: { damage: 12, damageType: 'physical', accuracy: 80, speed: 100, weaponRange: 1, minRange: 0 },
          },
        }),
      });

      const view = buildInventoryView(state);
      const item = view.items[0]!;

      expect(item.rarityColor).toMatch(/^#/);
      expect(item.rarity).toBe('rare');
    });

    it('calculates sell price using shop buyback multiplier', () => {
      const buybackMultiplier = 0.5;

      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('sword')],
        },
        world: {
          ...makeState().world,
          shop: { items: [], buybackMultiplier },
        },
        itemRegistry: makeItemRegistry({
          sword: {
            itemId: 'iron_sword',
            name: 'Iron Sword',
            description: 'A sword',
            itemClass: 'weapon',
            rarity: 'common',
            value: 100,
            stackable: false,
            spriteName: 'sword_iron',
            weapon: { damage: 8, damageType: 'physical', accuracy: 75, speed: 100, weaponRange: 1, minRange: 0 },
          },
        }),
      });

      const view = buildInventoryView(state);
      const item = view.items[0]!;

      expect(item.sellPrice).toBe(50);
    });

    it('filters out items not in itemRegistry', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('valid'), entityId('invalid')],
        },
        itemRegistry: makeItemRegistry({
          valid: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: false,
            spriteName: 'potion_green',
          },
        }),
      });

      const view = buildInventoryView(state);

      expect(view.items).toHaveLength(1);
      expect(view.items[0]?.id).toBe(entityId('valid'));
    });
  });

  describe('secondary weapon labeling', () => {
    it('adds (Off-hand) suffix to equipped secondary weapon', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [],
          equipment: {
            weapon: null,
            secondaryWeapon: entityId('dagger'),
            chest: null,
            head: null,
            gloves: null,
            boots: null,
            ring1: null,
            ring2: null,
          },
        },
        itemRegistry: makeItemRegistry({
          dagger: {
            itemId: 'iron_dagger',
            name: 'Iron Dagger',
            description: 'A dagger',
            itemClass: 'weapon',
            rarity: 'common',
            value: 30,
            stackable: false,
            spriteName: 'dagger_iron',
            weapon: { damage: 5, damageType: 'physical', accuracy: 80, speed: 120, weaponRange: 1, minRange: 0 },
          },
        }),
      });

      const view = buildInventoryView(state);
      const dagger = view.items[0]!;

      expect(dagger.name).toContain('(Off-hand)');
      expect(dagger.name).toContain('Iron Dagger');
    });

    it('does not add (Off-hand) suffix to non-weapon items', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [],
          equipment: {
            weapon: null,
            secondaryWeapon: null,
            chest: null,
            head: null,
            gloves: null,
            boots: null,
            ring1: entityId('ring'),
            ring2: null,
          },
        },
        itemRegistry: makeItemRegistry({
          ring: {
            itemId: 'iron_ring',
            name: 'Iron Ring',
            description: 'A ring',
            itemClass: 'armor',
            rarity: 'common',
            value: 50,
            stackable: false,
            spriteName: 'ring_iron',
            armor: { defense: 1, evasionPenalty: 0, slot: 'ring1', enchantmentSlots: 1, enchantments: [] },
          },
        }),
      });

      const view = buildInventoryView(state);
      const ring = view.items[0]!;

      expect(ring.name).toBe('Iron Ring');
      expect(ring.name).not.toContain('(Off-hand)');
    });
  });

  describe('equipped slot view', () => {
    it('populates equipped slots with equipment items', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [],
          equipment: {
            weapon: entityId('sword'),
            secondaryWeapon: null,
            chest: entityId('plate'),
            head: null,
            gloves: null,
            boots: null,
            ring1: null,
            ring2: null,
          },
        },
        itemRegistry: makeItemRegistry({
          sword: {
            itemId: 'steel_sword',
            name: 'Steel Sword',
            description: 'A sword',
            itemClass: 'weapon',
            rarity: 'uncommon',
            value: 75,
            stackable: false,
            spriteName: 'sword_steel',
            weapon: { damage: 10, damageType: 'physical', accuracy: 80, speed: 100, weaponRange: 1, minRange: 0 },
          },
          plate: {
            itemId: 'plate_mail',
            name: 'Plate Mail',
            description: 'Heavy armor',
            itemClass: 'armor',
            rarity: 'uncommon',
            value: 150,
            stackable: false,
            spriteName: 'armor_plate',
            armor: { defense: 5, evasionPenalty: 10, slot: 'chest', enchantmentSlots: 2, enchantments: [] },
          },
        }),
      });

      const view = buildInventoryView(state);

      expect(view.equipped.weapon?.id).toBe(entityId('sword'));
      expect(view.equipped.chest?.id).toBe(entityId('plate'));
      expect(view.equipped.head).toBeNull();
    });

    it('returns null for unequipped slots', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          equipment: {
            weapon: null,
            secondaryWeapon: null,
            chest: null,
            head: null,
            gloves: null,
            boots: null,
            ring1: null,
            ring2: null,
          },
        },
      });

      const view = buildInventoryView(state);

      expect(view.equipped.weapon).toBeNull();
      expect(view.equipped.chest).toBeNull();
      expect(view.equipped.head).toBeNull();
    });
  });

  describe('weapon and armor stats', () => {
    it('includes weapon stats for weapon items', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('sword')],
        },
        itemRegistry: makeItemRegistry({
          sword: {
            itemId: 'steel_sword',
            name: 'Steel Sword',
            description: 'A powerful sword',
            itemClass: 'weapon',
            rarity: 'rare',
            value: 200,
            stackable: false,
            spriteName: 'sword_steel',
            weapon: { damage: 15, damageType: 'slashing', accuracy: 85, speed: 95, weaponRange: 1, minRange: 0 },
          },
        }),
      });

      const view = buildInventoryView(state);
      const sword = view.items[0]!;

      expect(sword.weaponStats).toBeDefined();
      expect(sword.weaponStats?.damage).toBe(15);
      expect(sword.weaponStats?.damageType).toBe('slashing');
      expect(sword.weaponStats?.accuracy).toBe(85);
      expect(sword.armorStats).toBeUndefined();
    });

    it('includes armor stats for armor items', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('chest')],
        },
        itemRegistry: makeItemRegistry({
          chest: {
            itemId: 'plate_mail',
            name: 'Plate Mail',
            description: 'Heavy armor',
            itemClass: 'armor',
            rarity: 'uncommon',
            value: 150,
            stackable: false,
            spriteName: 'armor_plate',
            armor: { defense: 5, evasionPenalty: 10, slot: 'chest', enchantmentSlots: 2, enchantments: [] },
          },
        }),
      });

      const view = buildInventoryView(state);
      const chest = view.items[0]!;

      expect(chest.armorStats).toBeDefined();
      expect(chest.armorStats?.defense).toBe(5);
      expect(chest.armorStats?.evasionPenalty).toBe(10);
      expect(chest.armorStats?.slot).toBe('chest');
      expect(chest.weaponStats).toBeUndefined();
    });

    it('excludes stats for consumable items', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('potion')],
        },
        itemRegistry: makeItemRegistry({
          potion: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals 30 HP',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 5,
            spriteName: 'potion_green',
            consumable: { effect: 'heal', magnitude: 30 },
          },
        }),
      });

      const view = buildInventoryView(state);
      const potion = view.items[0]!;

      expect(potion.weaponStats).toBeUndefined();
      expect(potion.armorStats).toBeUndefined();
    });
  });

  describe('mixed inventory scenarios', () => {
    it('handles complex mix: stacked consumables + weapons + armor', () => {
      const state = makeState({
        player: {
          ...makeState().player,
          inventory: [entityId('p1'), entityId('s'), entityId('p2'), entityId('c')],
          equipment: {
            weapon: null,
            secondaryWeapon: null,
            chest: null,
            head: null,
            gloves: null,
            boots: null,
            ring1: null,
            ring2: null,
          },
        },
        itemRegistry: makeItemRegistry({
          p1: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
          p2: {
            itemId: 'health_potion',
            name: 'Health Potion',
            description: 'Heals',
            itemClass: 'consumable',
            rarity: 'common',
            value: 10,
            stackable: true,
            maxStack: 10,
            spriteName: 'potion_green',
          },
          s: {
            itemId: 'iron_sword',
            name: 'Iron Sword',
            description: 'A sword',
            itemClass: 'weapon',
            rarity: 'common',
            value: 50,
            stackable: false,
            spriteName: 'sword_iron',
            weapon: { damage: 8, damageType: 'physical', accuracy: 75, speed: 100, weaponRange: 1, minRange: 0 },
          },
          c: {
            itemId: 'leather_armor',
            name: 'Leather Armor',
            description: 'Light armor',
            itemClass: 'armor',
            rarity: 'common',
            value: 75,
            stackable: false,
            spriteName: 'armor_leather',
            armor: { defense: 2, evasionPenalty: 0, slot: 'chest', enchantmentSlots: 1, enchantments: [] },
          },
        }),
      });

      const view = buildInventoryView(state);

      // Should have: 1 stacked potion, 1 sword, 1 armor = 3 items
      expect(view.items).toHaveLength(3);

      const potions = view.items.filter(i => i.templateId === 'health_potion');
      expect(potions[0]?.quantity).toBe(2);

      const weapons = view.items.filter(i => i.templateId === 'iron_sword');
      expect(weapons[0]?.quantity).toBe(1);

      const armor = view.items.filter(i => i.templateId === 'leather_armor');
      expect(armor[0]?.quantity).toBe(1);
    });
  });
});
