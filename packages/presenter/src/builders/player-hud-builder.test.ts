/**
 * Test layer: unit
 * Behavior: buildPlayerHud exposes player stats, equipment, statuses, abilities, ring magic, quests, faction progress, and dungeon or town context from game state.
 * Proof: Assertions check HUD fields for name, level, health, combat stats, gold, equipment names, status presentation metadata, ability readiness and mana, ring school mastery and learned spells, quest titles, faction and ogre progress, floor, biome, weapon mastery, and town nulls.
 * Validation: pnpm vitest run packages/presenter/src/builders/player-hud-builder.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildPlayerHud } from './player-hud-builder.js';
import { PLAYER_STATUS_PRESENTATION, getStatusPresentation } from '../animation-metadata.js';
import { createTestGameState, createTestRunState, createTestGameStateWithAbility } from '@dungeon/core/testing';
import {
  addItemToInventory,
  equipItem,
  getNextSchoolDisplayLevelXp,
  getSchoolDisplayLevelFromXp,
  unequipItem,
} from '@dungeon/core';
import { entityId } from '@dungeon/contracts';
import type { GameState, ArmorTemplate } from '@dungeon/contracts';

describe('buildPlayerHud', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
  });

  const lightningRingFixture: ArmorTemplate = {
    itemId: 'lightning_ring',
    spriteName: 'topaz ring',
    name: 'Lightning Ring',
    description: 'A crackling ring that grants command over storms.',
    itemClass: 'armor',
    rarity: 'common',
    value: 20,
    stackable: false,
    maxStack: 1,
    armor: { defense: 0, evasionPenalty: 0, slot: 'ring', enchantmentSlots: 0, enchantments: [] },
  };

  describe('basic player stats', () => {
    it('displays player name', () => {
      state = { ...state, player: { ...state.player, name: 'Adventurer' } };

      const hud = buildPlayerHud(state);
      expect(hud.name).toBe('Adventurer');
    });

    it('displays player level', () => {
      state = { ...state, player: { ...state.player, level: 5 } };

      const hud = buildPlayerHud(state);
      expect(hud.level).toBe(5);
    });

    it('displays health stats', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, health: 45, maxHealth: 100 },
        },
      };

      const hud = buildPlayerHud(state);
      expect(hud.health).toBe(45);
      expect(hud.maxHealth).toBe(100);
    });

    it('displays combat stats', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          stats: {
            ...state.player.stats,
            attack: 12,
            defense: 8,
            accuracy: 75,
            evasion: 20,
          },
        },
      };

      const hud = buildPlayerHud(state);
      expect(hud.attack).toBe(12);
      expect(hud.defense).toBe(8);
      expect(hud.accuracy).toBe(75);
      expect(hud.evasion).toBe(20);
    });

    it('displays gold and experience', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          gold: 250,
          experience: 450,
        },
      };

      const hud = buildPlayerHud(state);
      expect(hud.gold).toBe(250);
      expect(hud.experience).toBe(450);
    });
  });

  describe('equipment', () => {
    it('displays equipped weapon', () => {
      const weaponId = entityId('sword1');
      state = {
        ...state,
        player: {
          ...state.player,
          equipment: { ...state.player.equipment, weapon: weaponId },
        },
        itemRegistry: {
          ...state.itemRegistry,
          items: new Map([
            [
              weaponId,
              {
                id: weaponId,
                name: 'Iron Sword',
                rarity: 'common',
                spriteName: 'sword',
                itemClass: 'weapon',
                weapon: { damage: 10, weaponType: 'blade', weaponRange: 1 },
              } as any,
            ],
          ]),
        },
      };

      const hud = buildPlayerHud(state);
      const weapon = hud.equippedItems.find(e => e.slot === 'weapon');
      expect(weapon).toBeDefined();
      expect(weapon?.name).toBe('Iron Sword');
    });

    it('displays armor pieces', () => {
      const chestId = entityId('chest1');
      state = {
        ...state,
        player: {
          ...state.player,
          equipment: { ...state.player.equipment, chest: chestId },
        },
        itemRegistry: {
          ...state.itemRegistry,
          items: new Map([
            [
              chestId,
              {
                id: chestId,
                name: 'Leather Chest',
                rarity: 'common',
                spriteName: 'chest',
                itemClass: 'armor',
                armor: { defense: 5, enchantments: [] },
              } as any,
            ],
          ]),
        },
      };

      const hud = buildPlayerHud(state);
      const chest = hud.equippedItems.find(e => e.slot === 'chest');
      expect(chest?.name).toBe('Leather Chest');
    });

    it('handles missing equipment gracefully', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        },
      };

      const hud = buildPlayerHud(state);
      expect(hud.equippedItems).toEqual([]);
    });
  });

  describe('statuses', () => {
    it('displays active statuses', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          statuses: [
            { id: 'poison', turnsRemaining: 3, magnitude: 1, sourceId: null },
            { id: 'bleed', turnsRemaining: 1, magnitude: 1, sourceId: null },
          ],
        },
      };

      const hud = buildPlayerHud(state);
      expect(hud.statuses).toHaveLength(2);
      expect(hud.statuses[0]?.id).toBe('poison');
      expect(hud.statuses[0]?.turnsRemaining).toBe(3);
    });

    it('attaches presentation metadata for statuses with player effects', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          statuses: [
            { id: 'strength', turnsRemaining: 3, magnitude: 3, sourceId: null },
          ],
        },
      };

      const hud = buildPlayerHud(state);
      expect(PLAYER_STATUS_PRESENTATION.strength).toBeDefined();

      expect(hud.statuses[0]?.presentation).toEqual(getStatusPresentation('strength'));
      expect(hud.statuses[0]?.presentation?.animationId).toBe(
        getStatusPresentation('strength')?.animationId,
      );
    });

    it('shows no statuses when player is healthy', () => {
      state = { ...state, player: { ...state.player, statuses: [] } };

      const hud = buildPlayerHud(state);
      expect(hud.statuses).toEqual([]);
    });
  });

  describe('abilities', () => {
    it('displays available abilities', () => {
      state = createTestGameStateWithAbility('power_strike');
      state = {
        ...state,
        player: {
          ...state.player,
          abilities: [
            { id: 'power_strike', cooldownRemaining: 0 },
            { id: 'second_wind', cooldownRemaining: 2 },
          ],
        },
      };

      const hud = buildPlayerHud(state);
      expect(hud.abilities).toHaveLength(2);
      expect(hud.abilities[0]?.id).toBe('power_strike');
      expect(hud.abilities[0]?.ready).toBe(true);
      expect(hud.abilities[1]?.id).toBe('second_wind');
      expect(hud.abilities[1]?.ready).toBe(false);
      expect(hud.abilities[1]?.cooldownRemaining).toBe(2);
    });

    it('filters abilities based on equipped weapon type', () => {
      const rangedWeaponId = entityId('bow1');
      state = {
        ...createTestGameState(),
        player: {
          ...state.player,
          equipment: { ...state.player.equipment, weapon: rangedWeaponId },
          abilities: [
            { id: 'power_strike', cooldownRemaining: 0 },
            { id: 'second_wind', cooldownRemaining: 0 },
          ],
        },
        itemRegistry: {
          items: new Map([
            [
              rangedWeaponId,
              {
                id: rangedWeaponId,
                name: 'Bow',
                rarity: 'common',
                spriteName: 'bow',
                itemClass: 'weapon',
                weapon: { damage: 6, weaponType: 'ranged', weaponRange: 3 },
              } as any,
            ],
          ]),
        },
      };

      const hud = buildPlayerHud(state);
      expect(hud.abilities.map(ability => ability.id)).toEqual(['second_wind']);
    });

    it('exposes mana and marks spells unavailable when mana is too low', () => {
      const currentMana = 0;
      state = createTestGameStateWithAbility('ember');
      state = {
        ...state,
        player: {
          ...state.player,
          mana: currentMana,
        },
      };

      const hud = buildPlayerHud(state);
      const ember = hud.abilities.find(ability => ability.id === 'ember');

      expect(hud.mana).toBe(currentMana);
      expect(hud.maxMana).toBeGreaterThan(currentMana);
      expect(ember?.manaCost).toBeGreaterThan(currentMana);
      expect(ember?.ready).toBe(false);
    });
  });

  describe('ring magic progression', () => {
    it('exposes global magic progression and school tiers from presenter data', () => {
      state = {
        ...state,
        player: {
          ...state.player,
          mana: 17,
          maxMana: 25,
          ringMastery: {
            fire: {
              xp: 100,
            },
          },
          learnedRingSpellIds: ['heat_surge'],
        },
      };

      const hud = buildPlayerHud(state);

      expect(hud.magicExperience).toBe(100);
      expect(hud.magicLevel).toBe(2);
      expect(hud.magicExperienceForNextLevel).toBe(150);
      expect(hud.spellPower).toBe(1);
      expect(hud.ringSchoolMasteries).toEqual([
        {
          school: 'fire',
          xp: 100,
          displayLevel: getSchoolDisplayLevelFromXp(100),
          nextDisplayLevelXp: getNextSchoolDisplayLevelXp(100),
        },
      ]);
      expect(hud.learnedSpells).toEqual([
        expect.objectContaining({
          spellId: 'heat_surge',
          manaCost: 11,
          xpGainOnCast: 2,
        }),
      ]);
    });

    it('shows Lightning mastery after equipping a Lightning Ring before any Lightning spell is learned', () => {
      state = createTestGameState({
        player: {
          abilities: [{ id: 'second_wind', cooldownRemaining: 0 }],
        },
      });
      const { state: withRingInInventory } = addItemToInventory(state, lightningRingFixture);
      const ringId = withRingInInventory.player.inventory[0]!;
      const { state: equipped } = equipItem(withRingInInventory, ringId);

      const hud = buildPlayerHud(equipped);

      expect(hud.ringSchoolMasteries).toEqual(expect.arrayContaining([
        expect.objectContaining({
          school: 'lightning',
          xp: 0,
        }),
      ]));
      expect(hud.learnedSpells).toEqual([]);
      expect(hud.abilities.map(ability => ability.id)).toContain('second_wind');
      expect(hud.abilities.map(ability => ability.id)).not.toContain('bolt');
    });

    it('keeps learned Lightning spells in the HUD but only exposes them as castable abilities while a Lightning Ring stays equipped', () => {
      state = createTestGameState({
        player: {
          abilities: [{ id: 'second_wind', cooldownRemaining: 0 }],
          ringMastery: {
            lightning: {
              xp: 60,
            },
          },
          learnedRingSpellIds: ['bolt'],
        },
      });
      const { state: withRingInInventory } = addItemToInventory(state, lightningRingFixture);
      const ringId = withRingInInventory.player.inventory[0]!;
      const { state: equipped } = equipItem(withRingInInventory, ringId);

      const equippedHud = buildPlayerHud(equipped);
      expect(equippedHud.abilities.map(ability => ability.id)).toContain('bolt');
      expect(equippedHud.learnedSpells).toEqual(expect.arrayContaining([
        expect.objectContaining({
          spellId: 'bolt',
          schools: ['lightning'],
        }),
      ]));
      expect(equippedHud.ringSchoolMasteries).toEqual(expect.arrayContaining([
        expect.objectContaining({
          school: 'lightning',
          xp: 60,
        }),
      ]));

      const { state: unequipped } = unequipItem(equipped, ringId);
      const unequippedHud = buildPlayerHud(unequipped);

      expect(unequippedHud.abilities.map(ability => ability.id)).not.toContain('bolt');
      expect(unequippedHud.learnedSpells).toEqual(expect.arrayContaining([
        expect.objectContaining({
          spellId: 'bolt',
          schools: ['lightning'],
        }),
      ]));
      expect(unequippedHud.ringSchoolMasteries).toEqual(expect.arrayContaining([
        expect.objectContaining({
          school: 'lightning',
          xp: 60,
        }),
      ]));
    });

    it('keeps learned Lightning spells castable in the HUD when a second equipped Lightning Ring still satisfies the school requirement', () => {
      state = createTestGameState({
        player: {
          abilities: [{ id: 'second_wind', cooldownRemaining: 0 }],
          ringMastery: {
            lightning: {
              xp: 60,
            },
          },
          learnedRingSpellIds: ['bolt'],
        },
      });
      const { state: withFirstRingInInventory } = addItemToInventory(state, lightningRingFixture);
      const { state: withBothRingsInInventory } = addItemToInventory(withFirstRingInInventory, lightningRingFixture);
      const firstRingId = withBothRingsInInventory.player.inventory[0]!;
      const secondRingId = withBothRingsInInventory.player.inventory[1]!;
      const { state: withFirstRing } = equipItem(withBothRingsInInventory, firstRingId);
      const { state: withBothRings } = equipItem(withFirstRing, secondRingId);
      const { state: withOneRingRemoved } = unequipItem(withBothRings, firstRingId);

      const hud = buildPlayerHud(withOneRingRemoved);

      expect(hud.abilities.map(ability => ability.id)).toContain('bolt');
      expect(hud.learnedSpells).toEqual(expect.arrayContaining([
        expect.objectContaining({
          spellId: 'bolt',
          schools: ['lightning'],
        }),
      ]));
      expect(hud.ringSchoolMasteries).toEqual(expect.arrayContaining([
        expect.objectContaining({
          school: 'lightning',
          xp: 60,
        }),
      ]));
    });
  });

  describe('quests', () => {
    it('displays active quests', () => {
      state = {
        ...state,
        activeQuests: [
          {
            id: 'q1',
            title: 'Slay the Dragon',
            description: 'A dragon has appeared',
            status: 'active',
            objective: {
              type: 'defeat_enemy',
              targetId: 'dragon',
              progress: 0,
            },
            reward: {
              type: 'gold',
              amount: 500,
            },
            giverNpcId: 'npc1',
          },
        ],
      };

      const hud = buildPlayerHud(state);
      expect(hud.activeQuests).toHaveLength(1);
      expect(hud.activeQuests[0]?.title).toBe('Slay the Dragon');
    });

    it('shows no quests when none are active', () => {
      state = { ...state, activeQuests: [] };

      const hud = buildPlayerHud(state);
      expect(hud.activeQuests).toEqual([]);
    });
  });

  describe('faction progress', () => {
    it('displays faction and ogre progress information', () => {
      state = {
        ...state,
        world: {
          ...state.world,
          factions: [
            {
              id: 'goblin_warband',
              name: 'Goblin Warband',
              power: 75,
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
              membersKilledByPlayer: 4,
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

      const hud = buildPlayerHud(state);
      expect(hud.factionProgress).toHaveLength(1);
      expect(hud.factionProgress[0]?.name).toBe('Goblin Warband');
      expect(hud.factionProgress[0]?.powerBand).toBe('strong');
      expect(hud.factionProgress[0]?.leader.name).toBe('Brakka');
      expect(hud.factionProgress[0]?.worldEffectText).toContain('150%');
      expect(hud.ogreProgress.summaryText).toContain('Break 1 more');
    });
  });

  describe('dungeon context', () => {
    beforeEach(() => {
      const run = createTestRunState();
      state = { ...createTestGameState({ phase: 'dungeon' }), run };
    });

    it('displays current floor depth', () => {
      state = {
        ...state,
        run: { ...state.run!, floor: { ...state.run!.floor, depth: 5 } },
      };

      const hud = buildPlayerHud(state);
      expect(hud.floor).toBe(5);
    });

    it('displays biome information when in dungeon', () => {
      const hud = buildPlayerHud(state);
      expect(hud.biomeId).toMatch(/\S/);
      expect(hud.biomeColor).toMatch(/^#/);
    });

    it('displays weapon mastery progress', () => {
      state = {
        ...state,
        weaponMastery: {
          blade: 5,
          bludgeon: 0,
          axe: 2,
          ranged: 1,
          dagger: 0,
        },
      };

      const hud = buildPlayerHud(state);
      expect(hud.weaponMastery).toBeDefined();
      expect(hud.weaponMastery?.blade).toBe(5);
    });
  });

  describe('town context', () => {
    beforeEach(() => {
      state = createTestGameState({ phase: 'town' });
    });

    it('shows null biome in town', () => {
      const hud = buildPlayerHud(state);
      expect(hud.biomeId).toBeNull();
    });

    it('shows null weapon mastery in town', () => {
      const hud = buildPlayerHud(state);
      expect(hud.weaponMastery).toBeNull();
    });
  });
});
