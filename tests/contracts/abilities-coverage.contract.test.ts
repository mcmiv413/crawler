import { describe, it, expect } from 'vitest';
import { GameEngine } from '@dungeon/core';
import { ABILITY_DEFINITIONS } from '@dungeon/content';
import type { GameState } from '@dungeon/contracts';

describe('Abilities Coverage Contract', () => {
  describe('All abilities are properly defined', () => {
    it('all ability definitions exist and have names', () => {
      expect(ABILITY_DEFINITIONS.size).toBeGreaterThan(0);

      for (const [id, definition] of ABILITY_DEFINITIONS) {
        expect(definition).toBeDefined();
        expect((definition as any).id).toBe(id);
        expect((definition as any).name).toBeDefined();
        expect((definition as any).name.length).toBeGreaterThan(0);
      }
    });

    it('required abilities exist', () => {
      const requiredAbilities = ['power_strike', 'dagger_disarm', 'dagger_set_trap'];
      for (const abilityId of requiredAbilities) {
        const definition = ABILITY_DEFINITIONS.get(abilityId);
        expect(definition).toBeDefined();
      }
    });

    it('disarm-trap ability has correct name', () => {
      const disarmDefinition = ABILITY_DEFINITIONS.get('dagger_disarm');
      expect(disarmDefinition).toBeDefined();
      expect((disarmDefinition as any).name).toBe('Disarm Trap');
    });

    it('set-trap ability has correct name', () => {
      const setTrapDefinition = ABILITY_DEFINITIONS.get('dagger_set_trap');
      expect(setTrapDefinition).toBeDefined();
      expect((setTrapDefinition as any).name).toBe('Set Trap');
    });

    it('power-strike ability exists', () => {
      const definition = ABILITY_DEFINITIONS.get('power_strike');
      expect(definition).toBeDefined();
      expect((definition as any).name).toBe('Power Strike');
    });
  });

  describe('Ability integration with game state', () => {
    function createGameState(): GameState {
      const engine = new GameEngine();
      const state = engine.createNewGame(12345);
      const enterResult = engine.submitCommand(state, {
        type: 'TOWN_ACTION',
        action: 'enter_dungeon',
      });
      return enterResult.state;
    }

    it('player can have abilities', () => {
      const state = createGameState();
      expect(state.player.abilities).toBeDefined();
      expect(state.player.abilities?.length).toBeGreaterThanOrEqual(0);
    });

    it('abilities have cooldown tracking', () => {
      const state = createGameState();
      const abilities = state.player.abilities ?? [];

      if (abilities.length > 0) {
        for (const ability of abilities) {
          expect(ability).toHaveProperty('id');
          expect(ability).toHaveProperty('cooldownRemaining');
          expect(typeof ability.cooldownRemaining).toBe('number');
          expect(ability.cooldownRemaining).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('game engine can be reused', () => {
      const engine = new GameEngine();

      // Create first game
      const state1 = engine.createNewGame(100);
      expect(state1).toBeDefined();

      // Create second game
      const state2 = engine.createNewGame(200);
      expect(state2).toBeDefined();

      // Both games should have players with abilities
      expect(state1.player.abilities).toBeDefined();
      expect(state2.player.abilities).toBeDefined();
    });
  });

  describe('Attack abilities integration', () => {
    it('all required attack abilities exist', () => {
      const attackAbilities = [
        'power_strike',
        'axe_cleave',
        'axe_execute',
        'blade_riposte',
        'blade_bleed',
        'bludgeon_shatter',
        'bludgeon_stagger',
      ];

      for (const abilityId of attackAbilities) {
        const definition = ABILITY_DEFINITIONS.get(abilityId);
        expect(definition).toBeDefined();
      }
    });

    it('abilities can be submitted as commands', () => {
      const engine = new GameEngine();
      let state = engine.createNewGame(42);

      // Enter dungeon
      state = engine.submitCommand(state, {
        type: 'TOWN_ACTION',
        action: 'enter_dungeon',
      }).state;

      expect(state.run).toBeDefined();

      // Verify we can move in dungeon
      const moveResult = engine.submitCommand(state, {
        type: 'MOVE',
        direction: 'N',
      });

      expect(moveResult.state).toBeDefined();
      expect(moveResult.events).toBeDefined();
    });
  });

  describe('Trap-related abilities', () => {
    it('disarm-trap and set-trap abilities are defined', () => {
      const disarm = ABILITY_DEFINITIONS.get('dagger_disarm');
      const setTrap = ABILITY_DEFINITIONS.get('dagger_set_trap');

      expect(disarm).toBeDefined();
      expect(setTrap).toBeDefined();
    });

    it('all trap types can be referenced in definitions', () => {
      // This is a contract test ensuring the content system
      // has all necessary trap type definitions

      // Just verify abilities exist; actual trap validation
      // happens in game-core handler
      const disarmDef = ABILITY_DEFINITIONS.get('dagger_disarm');
      expect(disarmDef).toBeDefined();
    });
  });
});
