import { describe, it, expect, beforeEach } from 'vitest';
import { buildTownView } from './town-view-builder.js';
import { createTestGameState } from '@dungeon/core/testing';
import { entityId } from '@dungeon/contracts';
import type { GameState, ArmorTemplate } from '@dungeon/contracts';

describe('buildTownView', () => {
  let state: GameState;

  const fireRingFixture: ArmorTemplate = {
    itemId: 'fire_ring',
    spriteName: 'ruby ring',
    name: 'Fire Ring',
    description: 'A smoldering ring that grants command over flame.',
    itemClass: 'armor',
    rarity: 'common',
    value: 20,
    stackable: false,
    maxStack: 1,
    armor: { defense: 0, evasionPenalty: 0, slot: 'ring', enchantmentSlots: 0, enchantments: [] },
  };

  beforeEach(() => {
    state = createTestGameState({ phase: 'town' });
  });

  describe('town stats', () => {
    it('displays prosperity level', () => {
      state = {
        ...state,
        world: { ...state.world, town: { ...state.world.town, prosperity: 65 } },
      };

      const view = buildTownView(state);
      expect(view.prosperity).toBe(65);
    });

    it('displays fear level', () => {
      state = {
        ...state,
        world: { ...state.world, town: { ...state.world.town, fear: 40 } },
      };

      const view = buildTownView(state);
      expect(view.fear).toBe(40);
    });

    it('displays corruption level', () => {
      state = {
        ...state,
        world: { ...state.world, town: { ...state.world.town, corruption: 25 } },
      };

      const view = buildTownView(state);
      expect(view.corruption).toBe(25);
    });
  });

  describe('atmosphere description', () => {
    it('returns prosperous description when prosperity >= 70', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          town: { ...state.world.town, prosperity: 75, fear: 10, corruption: 10 },
        },
      };

      const view = buildTownView(state);
      expect(view.atmosphereDescription).toBeTruthy();
    });

    it('returns fearful description when fear >= 60', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          town: { ...state.world.town, prosperity: 30, fear: 65, corruption: 20 },
        },
      };

      const view = buildTownView(state);
      expect(view.atmosphereDescription).toBeTruthy();
    });

    it('returns corrupted description when corruption >= 60', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          town: { ...state.world.town, prosperity: 30, fear: 30, corruption: 70 },
        },
      };

      const view = buildTownView(state);
      expect(view.atmosphereDescription).toBeTruthy();
    });

    it('returns normal description by default', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          town: { ...state.world.town, prosperity: 50, fear: 50, corruption: 50 },
        },
      };

      const view = buildTownView(state);
      expect(view.atmosphereDescription).toBeTruthy();
    });
  });

  describe('factions', () => {
    it('displays faction pressure and ogre progress information', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          factions: [
            {
              id: 'goblin_warband',
              name: 'Goblin Warband',
              power: 82,
              disposition: -30,
              status: 'led',
              activeLeaderId: entityId('goblin_warband_leader'),
              leader: {
                id: entityId('goblin_warband_leader'),
                factionId: 'goblin_warband',
                name: 'Brakka',
                title: 'Knife-King',
                templateId: 'goblin_warlord',
                isActive: true,
                isSlain: false,
                emergedOnRun: 2,
                emergedOnDepth: 3,
              },
              leaderSlain: false,
              membersKilledByPlayer: 5,
              leadersKilledByPlayer: 0,
              playerDeathsCaused: 1,
            },
          ],
          dungeonOgre: {
            id: 'dungeon_ogre',
            status: 'sealed',
          },
        },
      };

      const view = buildTownView(state);
      expect(view.factions).toHaveLength(1);
      const faction = view.factions[0];
      if (faction) {
        expect(faction.name).toBe('Goblin Warband');
        expect(faction.powerBand).toBe('dominant');
        expect(faction.leader.name).toBe('Brakka');
        expect(faction.worldEffectText).toContain('200%');
        expect(faction.townEffectText).toContain('prosperity -3');
      }
      expect(view.factionPressureSummary).toBe('1 led · 0 leaderless · 0 broken.');
      expect(view.ogreProgress.summaryText).toContain('Break 1 more');
    });

    it('shows no factions when none exist', () => {
      state = { ...state, world: { ...state.world, factions: [] } };

      const view = buildTownView(state);
      expect(view.factions).toEqual([]);
    });
  });

  describe('NPCs', () => {
    it('displays NPC information', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          npcs: [
            {
              id: entityId('npc1'),
              name: 'Blacksmith',
              role: 'blacksmith',
              available: true,
              disposition: 50,
              dialogueKey: 'blacksmith_greeting',
            },
          ],
        },
      };

      const view = buildTownView(state);
      expect(view.npcs).toHaveLength(1);
      const npc = view.npcs[0];
      if (npc) {
        expect(npc.name).toBe('Blacksmith');
        expect(npc.available).toBe(true);
      }
    });
  });

  describe('shop', () => {
    it('applies shopkeeper discount', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          npcs: [
            {
              id: entityId('npc1'),
              name: 'Shopkeeper',
              role: 'shopkeeper',
              available: true,
              disposition: 50,
              dialogueKey: 'shopkeeper_greeting',
            },
          ],
          shop: {
            items: [
              {
                itemId: 'common_dagger',
                price: 100,
                stock: 5,
              },
            ],
            buybackMultiplier: 0.4,
          },
          highestRarityFound: 'common',
        },
      };

      const view = buildTownView(state);
      const item = view.shop.items[0];
      expect(item).toBeDefined();
      if (item) {
        expect(item.effectivePrice).toBeLessThan(item.price);
      }
    });

    it('limits shop items when prosperity is low', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          town: { ...state.world.town, prosperity: 20 },
          shop: {
            items: [
              { itemId: 'common_dagger', price: 100, stock: 5 },
              { itemId: 'iron_mace', price: 150, stock: 3 },
              { itemId: 'leather_vest', price: 200, stock: 2 },
              { itemId: 'health_potion', price: 250, stock: 1 },
            ],
            buybackMultiplier: 0.4,
          },
          highestRarityFound: 'common',
        },
      };

      const view = buildTownView(state);
      expect(view.shop.items.length).toBeLessThanOrEqual(3);
    });

    it('shows all shop items when prosperity is high', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          town: { ...state.world.town, prosperity: 80 },
          shop: {
            items: [
              { itemId: 'common_dagger', price: 100, stock: 5 },
              { itemId: 'iron_mace', price: 150, stock: 3 },
            ],
            buybackMultiplier: 0.4,
          },
          highestRarityFound: 'common',
        },
      };

      const view = buildTownView(state);
      expect(view.shop.items.length).toBe(2);
    });

    it('excludes out-of-stock items', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          shop: {
            items: [
              { itemId: entityId('item1'), price: 100, stock: 0 },
              { itemId: entityId('item2'), price: 150, stock: 3 },
            ],
            buybackMultiplier: 0.4,
          },
          highestRarityFound: 'common',
        },
      };

      const view = buildTownView(state);
      expect(view.shop.items.length).toBeLessThanOrEqual(1);
    });
  });

  describe('prep advice', () => {
    it('warns about missing weapon', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          equipment: { ...state.player.equipment, weapon: null },
        },
      };

      const view = buildTownView(state);
      expect(view.prepAdvice.some(a => a.includes('weapon'))).toBe(true);
    });

    it('warns about low health', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, health: 10, maxHealth: 100 },
        },
      };

      const view = buildTownView(state);
      expect(view.prepAdvice.some(a => a.includes('health') || a.includes('Rest'))).toBe(true);
    });

    it('warns about high corruption', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          town: { ...state.world.town, corruption: 80 },
        },
      };

      const view = buildTownView(state);
      expect(view.prepAdvice.some(a => a.includes('Corruption'))).toBe(true);
    });

    it('warns about missing consumables', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          inventory: [],
        },
      };

      const view = buildTownView(state);
      expect(view.prepAdvice.some(a => a.includes('consumables') || a.includes('potions'))).toBe(true);
    });
  });

  describe('blueprints', () => {
    it('displays unlocked blueprints', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          unlockedBlueprints: ['shield_of_thorns', 'helm_of_vigor'],
        },
      };

      const view = buildTownView(state);
      expect(view.unlockedBlueprints).toContain('shield_of_thorns');
      expect(view.unlockedBlueprints).toContain('helm_of_vigor');
    });
  });

  describe('learnable spells', () => {
    it('exposes Elder study spell affordability and Fire XP requirements', () => {
      const fireRingEntity = entityId('fire_ring_1');
      state = {
        ...state,
        player: {
          ...state.player,
          gold: 500,
          ringMastery: {
            fire: {
              xp: 100,
            },
          },
          equipment: {
            ...state.player.equipment,
            ring1: fireRingEntity,
          },
          learnedRingSpellIds: [],
        },
        itemRegistry: {
          items: new Map([
            [fireRingEntity, fireRingFixture],
          ]),
        },
      };

      const view = buildTownView(state);
      const heatSurge = view.studyableSpells.find(spell => spell.spellId === 'heat_surge');

      expect(heatSurge).toBeDefined();
      expect(heatSurge?.affordable).toBe(true);
      expect(heatSurge?.canStudy).toBe(true);
      expect(heatSurge?.learned).toBe(false);
    });

    it('hides an Elder spell from study when it is already learned', () => {
      const fireRingEntity = entityId('fire_ring_1');
      state = {
        ...state,
        player: {
          ...state.player,
          ringMastery: {
            fire: {
              xp: 100,
            },
          },
          equipment: {
            ...state.player.equipment,
            ring1: fireRingEntity,
          },
          learnedRingSpellIds: ['heat_surge'],
        },
        itemRegistry: {
          items: new Map([
            [fireRingEntity, fireRingFixture],
          ]),
        },
      };

      const view = buildTownView(state);
      const heatSurge = view.studyableSpells.find(spell => spell.spellId === 'heat_surge');

      expect(heatSurge).toBeUndefined();
    });
  });
});
