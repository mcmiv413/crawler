import { describe, it, expect, beforeEach } from 'vitest';
import { buildTownView } from './town-view-builder.js';
import { createTestGameState } from '@dungeon/core/testing';
import { entityId } from '@dungeon/contracts';
import type { GameState } from '@dungeon/contracts';

describe('buildTownView', () => {
  let state: GameState;

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
    it('displays faction information', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          factions: [
            {
              id: 'faction1',
              name: 'Guild of Thieves',
              power: 50,
              disposition: 10,
            },
          ],
        },
      };

      const view = buildTownView(state);
      expect(view.factions).toHaveLength(1);
      const faction = view.factions[0];
      if (faction) {
        expect(faction.name).toBe('Guild of Thieves');
        expect(faction.power).toBe(50);
      }
    });

    it('shows no factions when none exist', () => {
      state = { ...state, world: { ...state.world, factions: [] } };

      const view = buildTownView(state);
      expect(view.factions).toEqual([]);
    });
  });

  describe('nemeses', () => {
    it('displays only active nemeses', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          nemeses: [
            {
              id: entityId('nemesis1'),
              name: 'Dread Goblin',
              title: 'The Terrible',
              isActive: true,
              tier: 2,
              rank: 1,
              floorOfAscension: 5,
              killCount: 3,
              killedByWeaponType: null,
              sourceTemplateId: 'goblin',
              weaknesses: [],
              stats: { maxHealth: 100, health: 100, attack: 20, defense: 10, accuracy: 75, evasion: 20, speed: 10 },
              traits: [],
              killEventId: null,
              encounterCount: 5,
              biomeOfAscension: 'cavern',
            },
            {
              id: entityId('nemesis2'),
              name: 'Slain Orc',
              title: 'The Defeated',
              isActive: false,
              tier: 1,
              rank: 0,
              floorOfAscension: 3,
              killCount: 0,
              killedByWeaponType: 'blade',
              sourceTemplateId: 'orc',
              weaknesses: [],
              stats: { maxHealth: 80, health: 0, attack: 15, defense: 8, accuracy: 60, evasion: 15, speed: 8 },
              traits: [],
              killEventId: entityId('kill1'),
              encounterCount: 3,
              biomeOfAscension: 'forest',
            },
          ],
        },
      };

      const view = buildTownView(state);
      expect(view.nemeses).toHaveLength(1);
      const activeNemesis = view.nemeses[0];
      if (activeNemesis) {
        expect(activeNemesis.name).toBe('Dread Goblin');
      }
      expect(view.slainNemeses).toHaveLength(1);
      const slainNemesis = view.slainNemeses[0];
      if (slainNemesis) {
        expect(slainNemesis.name).toBe('Slain Orc');
      }
    });

    it('shows empty nemesis lists when none exist', () => {
      state = { ...state, world: { ...state.world, nemeses: [] } };

      const view = buildTownView(state);
      expect(view.nemeses).toEqual([]);
      expect(view.slainNemeses).toEqual([]);
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
          highestRarityFound: 'uncommon',
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
});
