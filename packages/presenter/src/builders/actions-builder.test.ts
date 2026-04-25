import { describe, it, expect, beforeEach } from 'vitest';
import { buildAvailableActions } from './actions-builder.js';
import { createTestGameState, createTestRunState, createTestEnemy } from '@dungeon/core/testing';
import { entityId } from '@dungeon/contracts';
import type { GameState } from '@dungeon/contracts';

describe('buildAvailableActions', () => {
  let state: GameState;

  describe('town phase', () => {
    beforeEach(() => {
      state = createTestGameState({ phase: 'town' });
    });

    it('includes enter_dungeon action', () => {
      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === 'enter_dungeon')).toBe(true);
    });

    it('includes rest action enabled when health < maxHealth', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, health: 10, maxHealth: 50 },
        },
      };

      const actions = buildAvailableActions(state);
      const restAction = actions.find(a => a.id === 'rest');
      expect(restAction).toBeDefined();
      expect(restAction?.enabled).toBe(true);
    });

    it('disables rest action when health is full', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, health: 50, maxHealth: 50 },
        },
      };

      const actions = buildAvailableActions(state);
      const restAction = actions.find(a => a.id === 'rest');
      expect(restAction?.enabled).toBe(false);
    });

    it('includes shop action', () => {
      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === 'shop')).toBe(true);
    });

    it('includes NPC talk actions for available NPCs', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          npcs: [
            {
              id: entityId('npc1'),
              name: 'Blacksmith',
              available: true,
              type: 'blacksmith',
              stats: { maxHealth: 100, health: 100, attack: 5, defense: 5, accuracy: 50, evasion: 20 },
              position: { x: 5, y: 5 },
            },
          ],
        },
      };

      const actions = buildAvailableActions(state);
      const npcAction = actions.find(a => a.id === 'talk_npc1');
      expect(npcAction).toBeDefined();
      expect(npcAction?.label).toContain('Blacksmith');
    });

    it('excludes unavailable NPCs from talk actions', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          npcs: [
            {
              id: entityId('npc1'),
              name: 'Blacksmith',
              available: false,
              type: 'blacksmith',
              stats: { maxHealth: 100, health: 100, attack: 5, defense: 5, accuracy: 50, evasion: 20 },
              position: { x: 5, y: 5 },
            },
          ],
        },
      };

      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === 'talk_npc1')).toBe(false);
    });
  });

  describe('dungeon phase', () => {
    beforeEach(() => {
      const run = createTestRunState();
      state = { ...createTestGameState({ phase: 'dungeon' }), run };
    });

    it('includes movement actions', () => {
      const actions = buildAvailableActions(state);
      const directions = ['move_n', 'move_s', 'move_e', 'move_w'];
      directions.forEach(dir => {
        expect(actions.some(a => a.id === dir)).toBe(true);
      });
    });

    it('includes wait action', () => {
      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === 'wait')).toBe(true);
    });

    it('includes attack actions for visible enemies within weapon range', () => {
      const enemy = createTestEnemy({
        id: entityId('e1'),
        name: 'Goblin',
        position: { x: state.player.position.x + 1, y: state.player.position.y },
      });

      state = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([[enemy.id, enemy]]),
          floor: {
            ...state.run!.floor,
            cells: new Map([
              ['5,5', { tile: { type: 'floor' }, visibility: 'visible' }],
              ['6,5', { tile: { type: 'floor' }, visibility: 'visible' }],
            ]),
          },
        },
      };

      const actions = buildAvailableActions(state);
      const attackAction = actions.find(a => a.id === `attack_${enemy.id}`);
      expect(attackAction).toBeDefined();
      expect(attackAction?.label).toContain('Goblin');
    });

    it('excludes enemies outside weapon range', () => {
      const enemy = createTestEnemy({
        id: entityId('e1'),
        name: 'Far Enemy',
        position: { x: state.player.position.x + 10, y: state.player.position.y },
      });

      state = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([[enemy.id, enemy]]),
        },
      };

      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === `attack_${enemy.id}`)).toBe(false);
    });

    it('labels melee attacks as Attack and ranged as Shoot', () => {
      const meleeEnemy = createTestEnemy({
        id: entityId('e1'),
        position: { x: state.player.position.x + 1, y: state.player.position.y },
      });

      state = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([[meleeEnemy.id, meleeEnemy]]),
          floor: {
            ...state.run!.floor,
            cells: new Map([
              ['5,5', { tile: { type: 'floor' }, visibility: 'visible' }],
              ['6,5', { tile: { type: 'floor' }, visibility: 'visible' }],
            ]),
          },
        },
      };

      const actions = buildAvailableActions(state);
      const action = actions.find(a => a.id === `attack_${meleeEnemy.id}`);
      expect(action?.label).toContain('Attack');
    });

    it('includes retreat action when on entrance', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          position: state.run!.floor.entrance,
        },
        run: {
          ...state.run!,
          floor: {
            ...state.run!.floor,
            cells: new Map([
              [
                '0,0',
                { tile: { type: 'floor' }, visibility: 'visible' },
              ],
            ]),
          },
        },
      };

      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === 'retreat')).toBe(true);
    });

    it('includes ascend action when on stairs_up with floor history', () => {
      state = {
        ...state,
        run: {
          ...state.run!,
          floorHistory: [{ depth: 0, biomeId: 'crypt' }],
          floor: {
            ...state.run!.floor,
            cells: new Map([
              [
                '5,5',
                { tile: { type: 'stairs_up' }, visibility: 'visible' },
              ],
            ]),
          },
        },
        player: {
          ...state.player,
          position: { x: 5, y: 5 },
        },
      };

      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === 'ascend')).toBe(true);
    });

    it('includes object interaction actions for adjacent objects', () => {
      state = {
        ...state,
        run: {
          ...state.run!,
          objects: new Map([
            ['6,5', { templateId: 'chest', position: { x: 6, y: 5 } }],
          ]),
          floor: {
            ...state.run!.floor,
            cells: new Map([
              ['5,5', { tile: { type: 'floor' }, visibility: 'visible' }],
              ['6,5', { tile: { type: 'floor' }, visibility: 'visible' }],
            ]),
          },
        },
      };

      const actions = buildAvailableActions(state);
      const interactAction = actions.find(a => a.id === 'interact_6,5');
      expect(interactAction).toBeDefined();
      expect(interactAction?.type).toBe('interact');
    });

    it('includes ability actions with cooldown labels', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          abilities: [
            {
              id: 'power_strike',
              cooldownRemaining: 3,
            },
          ],
        },
      };

      const actions = buildAvailableActions(state);
      const abilityAction = actions.find(a => a.id === 'use_ability_power_strike');
      expect(abilityAction).toBeDefined();
      expect(abilityAction?.label).toContain('3 turns');
      expect(abilityAction?.enabled).toBe(false);
    });

    it('enables ability actions when cooldown is 0', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          abilities: [
            {
              id: 'power_strike',
              cooldownRemaining: 0,
            },
          ],
        },
      };

      const actions = buildAvailableActions(state);
      const abilityAction = actions.find(a => a.id === 'use_ability_power_strike');
      expect(abilityAction?.enabled).toBe(true);
    });

    it('includes consumable item actions', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          inventory: [entityId('health_potion_1')],
        },
        itemRegistry: {
          ...state.itemRegistry,
          items: new Map([
            [
              entityId('health_potion_1'),
              {
                id: entityId('health_potion_1'),
                name: 'Health Potion',
                itemClass: 'consumable',
              } as any,
            ],
          ]),
        },
      };

      const actions = buildAvailableActions(state);
      const useAction = actions.find(a => a.id === `use_${entityId('health_potion_1')}`);
      expect(useAction).toBeDefined();
      expect(useAction?.label).toContain('Health Potion');
    });

    it('excludes non-consumable items from action list', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          inventory: [entityId('iron_sword_1')],
        },
        itemRegistry: {
          ...state.itemRegistry,
          items: new Map([
            [
              entityId('iron_sword_1'),
              {
                id: entityId('iron_sword_1'),
                name: 'Iron Sword',
                itemClass: 'weapon',
              } as any,
            ],
          ]),
        },
      };

      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === `use_${entityId('iron_sword_1')}`)).toBe(false);
    });
  });

  describe('invalid phase', () => {
    it('returns empty array for unknown phase', () => {
      state = createTestGameState({ phase: 'village' as any });

      const actions = buildAvailableActions(state);
      expect(actions).toEqual([]);
    });
  });

  describe('null run in dungeon phase', () => {
    it('returns only movement and wait actions when run is null', () => {
      state = createTestGameState({ phase: 'dungeon' });

      const actions = buildAvailableActions(state);
      const actionIds = actions.map(a => a.id);

      // Should have movement and wait
      expect(actionIds).toContain('move_n');
      expect(actionIds).toContain('wait');

      // Should not have dungeon-specific actions
      expect(actionIds.some(a => a.startsWith('attack_'))).toBe(false);
      expect(actionIds.some(a => a.startsWith('retreat'))).toBe(false);
    });
  });
});
