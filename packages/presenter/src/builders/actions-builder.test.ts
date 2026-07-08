/**
 * Test layer: unit
 * Behavior: buildAvailableActions exposes the correct enabled actions for town, dungeon, ability, item, object, movement, retreat, ascend, and invalid-state contexts.
 * Proof: Assertions check action IDs such as enter_dungeon, rest, talk_npc1, movement, attack, retreat, ascend, interact_*, use_ability_power_strike, use_ability_thunder_step, and consumable use_*, plus enabled flags, labels, tileTarget, and empty arrays for invalid or missing-run states.
 * Validation: pnpm vitest run packages/presenter/src/builders/actions-builder.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildAvailableActions } from './actions-builder.js';
import {
  createTestGameState,
  createTestRunState,
  createTestEnemy,
  createTestGameStateInCombat,
  createTestGameStateWithAbility,
} from '@dungeon/core/testing';
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
              role: 'blacksmith',
              disposition: 0,
              available: true,
              dialogueKey: 'blacksmith_intro',
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
              role: 'blacksmith',
              disposition: 0,
              available: false,
              dialogueKey: 'blacksmith_intro',
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
      state = createTestGameStateInCombat();
      const enemy = Array.from(state.run!.enemies.values())[0]!;

      const actions = buildAvailableActions(state);
      const attackAction = actions.find(a => a.id === `attack_${enemy.id}`);
      expect(attackAction).toBeDefined();
      expect(attackAction?.label).toContain(enemy.name);
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
      const meleeState = createTestGameStateInCombat();
      const meleeEnemy = Array.from(meleeState.run!.enemies.values())[0]!;
      const meleeActions = buildAvailableActions(meleeState);
      const meleeAction = meleeActions.find(a => a.id === `attack_${meleeEnemy.id}`);

      let rangedState = createTestGameStateInCombat({
        equippedWeaponId: 'short_bow',
        enemyAt: { x: 2, y: 0 },
      });
      const visibleFloorCell = rangedState.run!.floor.cells.get('1,0')!;
      rangedState = {
        ...rangedState,
        run: {
          ...rangedState.run!,
          floor: {
            ...rangedState.run!.floor,
            cells: new Map([
              ...rangedState.run!.floor.cells,
              ['2,0', visibleFloorCell],
            ]),
          },
        },
      };
      const rangedEnemy = Array.from(rangedState.run!.enemies.values())[0]!;
      const rangedActions = buildAvailableActions(rangedState);
      const rangedAction = rangedActions.find(a => a.id === `attack_${rangedEnemy.id}`);

      expect(meleeAction?.label).toContain('Attack');
      expect(rangedAction?.label).toContain('Shoot');
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
              ['0,0', state.run!.floor.cells.get('0,0')!],
            ]),
          },
        },
      };

      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === 'retreat')).toBe(true);
    });

    it('includes ascend action when on stairs_up below floor 1', () => {
      state = {
        ...state,
        run: {
          ...state.run!,
          floor: {
            ...state.run!.floor,
            cells: new Map([
              [
                '5,5',
                {
                  tile: {
                    type: 'stairs_up',
                    walkable: true,
                    blocksVision: false,
                    ascii: '<',
                    color: '#fff',
                  },
                  visibility: 'visible',
                },
              ],
            ]),
          },
        },
        player: {
          ...state.player,
          floor: 2,
          position: { x: 5, y: 5 },
        },
      };

      const actions = buildAvailableActions(state);
      expect(actions.some(a => a.id === 'ascend')).toBe(true);
    });

    it('includes object interaction actions for adjacent objects', () => {
      const adjacentObjectPos = { x: state.player.position.x + 1, y: state.player.position.y };
      const adjacentObjectKey = `${adjacentObjectPos.x},${adjacentObjectPos.y}`;

      state = {
        ...state,
        run: {
          ...state.run!,
          objects: new Map([
            [
              adjacentObjectKey,
              {
                id: entityId('chest1'),
                templateId: 'chest',
                position: adjacentObjectPos,
                isExhausted: false,
              },
            ],
          ]),
        },
      };

      const actions = buildAvailableActions(state);
      const interactAction = actions.find(a => a.id === `interact_${adjacentObjectKey}`);
      expect(interactAction).toBeDefined();
      expect(interactAction?.type).toBe('interact');
    });

    it('includes ability actions with cooldown labels', () => {
      state = createTestGameStateWithAbility('power_strike');
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
      state = createTestGameStateWithAbility('power_strike');

      const actions = buildAvailableActions(state);
      const abilityAction = actions.find(a => a.id === 'use_ability_power_strike');
      expect(abilityAction?.enabled).toBe(true);
    });

    it('marks tile-target spells as enabled without a visible enemy target', () => {
      const baseState = createTestGameStateInCombat();
      state = {
        ...baseState,
        player: {
          ...baseState.player,
          mana: 99,
          abilities: [
            {
              id: 'thunder_step',
              cooldownRemaining: 0,
            },
          ],
        },
      };

      const actions = buildAvailableActions(state);
      const abilityAction = actions.find(a => a.id === 'use_ability_thunder_step');

      expect(abilityAction).toEqual(expect.objectContaining({
        enabled: true,
        tileTarget: true,
        type: 'ability',
      }));
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
    it('returns no actions when the dungeon run is missing', () => {
      state = createTestGameState({ phase: 'dungeon' });

      const actions = buildAvailableActions(state);

      expect(actions).toEqual([]);
    });
  });
});
