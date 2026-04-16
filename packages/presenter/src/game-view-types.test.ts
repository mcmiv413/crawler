/**
 * Failing tests for DeathContext and NemesisView spriteName
 * in the GameView type system.
 */

import { describe, it, expect } from 'vitest';
import type { DeathContext, NemesisView, GameView } from './game-view.js';

describe('GameView DeathContext type', () => {
  it('should define DeathContext interface with required fields', () => {
    const context: DeathContext = {
      killerName: 'Goblin',
      killerSpriteName: 'enemy_goblin_01',
      floor: 3,
      equipmentLost: [
        { slot: 'weapon', itemName: 'Iron Sword' },
        { slot: 'chest', itemName: 'Leather Armor' },
      ],
      goldLost: 100,
      overkillDamage: 0,
      permadeathThreshold: 50,
      totalDeaths: 5,
    };

    expect(context.killerName).toBe('Goblin');
    expect(context.floor).toBe(3);
  });

  it('should allow null killerName and killerSpriteName', () => {
    const context: DeathContext = {
      killerName: null,
      killerSpriteName: null,
      floor: 3,
      equipmentLost: [],
      goldLost: 50,
      overkillDamage: 0,
      permadeathThreshold: 50,
      totalDeaths: 1,
    };

    expect(context.killerName).toBeNull();
    expect(context.killerSpriteName).toBeNull();
  });

  it('should define equipmentLost as array of {slot, itemName}', () => {
    const context: DeathContext = {
      killerName: 'Dragon',
      killerSpriteName: 'enemy_dragon_01',
      floor: 7,
      equipmentLost: [
        { slot: 'weapon', itemName: 'Excalibur' },
        { slot: 'chest', itemName: 'Plate Armor' },
        { slot: 'head', itemName: 'Crown' },
      ],
      goldLost: 500,
      overkillDamage: 75,
      permadeathThreshold: 50,
      totalDeaths: 3,
    };

    expect(context.equipmentLost).toHaveLength(3);
    expect(context.equipmentLost[0]!.slot).toBe('weapon');
    expect(context.equipmentLost[0]!.itemName).toBe('Excalibur');
  });

  it('should enforce readonly on DeathContext fields', () => {
    const context: Readonly<DeathContext> = {
      killerName: 'Orc',
      killerSpriteName: 'enemy_orc_01',
      floor: 5,
      equipmentLost: [],
      goldLost: 75,
      overkillDamage: 0,
      permadeathThreshold: 50,
      totalDeaths: 2,
    };

    expect(context.killerName).toBe('Orc');
    // Type system will prevent mutations at compile time
  });
});

describe('NemesisView spriteName field', () => {
  it('should have spriteName field on NemesisView', () => {
    const nemesis: NemesisView = {
      id: 'nem1',
      name: 'Lord of Shadows',
      title: 'Nemesis',
      tier: 3,
      rank: 2,
      floorOfAscension: 5,
      killCount: 3,
      killedByWeaponType: null,
      isActive: true,
      weaknesses: ['fire', 'light'],
      spriteName: 'enemy_nemesis_shadows_01',
    };

    expect(nemesis.spriteName).toBe('enemy_nemesis_shadows_01');
  });

  it('should allow null spriteName if template not found', () => {
    const nemesis: NemesisView = {
      id: 'nem2',
      name: 'Unknown Entity',
      title: 'Nemesis',
      tier: 2,
      rank: 1,
      floorOfAscension: 3,
      killCount: 1,
      killedByWeaponType: null,
      isActive: false,
      weaknesses: [],
      spriteName: null,
    };

    expect(nemesis.spriteName).toBeNull();
  });

  it('should be readonly on NemesisView', () => {
    const nemesis: Readonly<NemesisView> = {
      id: 'nem3',
      name: 'Cursed Knight',
      title: 'Nemesis',
      tier: 2,
      rank: 1,
      floorOfAscension: 4,
      killCount: 2,
      killedByWeaponType: 'axe',
      isActive: true,
      weaknesses: ['holy'],
      spriteName: 'enemy_knight_cursed_01',
    };

    expect(nemesis.spriteName).toBe('enemy_knight_cursed_01');
  });
});

describe('GameView deathContext field', () => {
  it('should have deathContext field on GameView', () => {
    const view = {
      gameId: 'g1',
      phase: 'town' as const,
      player: {} as any,
      map: null,
      combatLog: [],
      availableActions: [],
      town: null,
      inventory: {} as any,
      activeQuests: [],
      runResult: 'death' as const,
      deathStashFloor: null,
      deathSummary: null,
      inspectableEntities: [],
      debugMode: false,
      deathContext: {
        killerName: 'Goblin',
        killerSpriteName: 'enemy_goblin_01',
        floor: 3,
        equipmentLost: [],
        goldLost: 50,
        overkillDamage: 0,
        permadeathThreshold: 50,
        totalDeaths: 1,
      },
    };

    expect((view as any).deathContext).not.toBeNull();
    expect((view as any).deathContext.killerName).toBe('Goblin');
  });

  it('should allow null deathContext when not in death state', () => {
    const view = {
      gameId: 'g1',
      phase: 'dungeon' as const,
      player: {} as any,
      map: null,
      combatLog: [],
      availableActions: [],
      town: null,
      inventory: {} as any,
      activeQuests: [],
      runResult: null,
      deathStashFloor: null,
      deathSummary: null,
      inspectableEntities: [],
      debugMode: false,
      deathContext: null,
    };

    expect((view as any).deathContext).toBeNull();
  });
});
