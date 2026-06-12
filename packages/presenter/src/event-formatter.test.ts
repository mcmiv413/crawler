import { describe, it, expect } from 'vitest';
import { formatEvent, formatEvents } from './event-formatter.js';
import type { DomainEvent } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';

const ts = Date.now();
const base = { timestamp: ts, turnNumber: 1 };

describe('formatEvent', () => {
  it('formats ATTACK_PERFORMED hit with damage', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ATTACK_PERFORMED',
      attackerId: entityId('p1'),
      defenderId: entityId('e1'),
      attackerName: 'Adventurer',
      defenderName: 'Skeleton',
      damage: 15,
      damageType: 'physical',
      hit: true,
      critical: false,
      position: { x: 10, y: 10 },
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: '[Adventurer -> Skeleton] hit for 15 physical damage',
      type: 'attack',
      timestamp: ts,
    });
  });

  it('formats ATTACK_PERFORMED critical hit', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ATTACK_PERFORMED',
      attackerId: entityId('p1'),
      defenderId: entityId('e1'),
      attackerName: 'Adventurer',
      defenderName: 'Skeleton',
      damage: 30,
      damageType: 'physical',
      hit: true,
      critical: true,
      position: { x: 10, y: 10 },
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: '[Adventurer -> Skeleton] hit for 30 physical damage CRIT!',
      type: 'attack',
      timestamp: ts,
    });
  });

  it('formats ATTACK_PERFORMED miss', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ATTACK_PERFORMED',
      attackerId: entityId('p1'),
      defenderId: entityId('e1'),
      attackerName: 'Adventurer',
      defenderName: 'Skeleton',
      damage: 0,
      damageType: 'physical',
      hit: false,
      critical: false,
      position: { x: 10, y: 10 },
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: '[Adventurer -> Skeleton] Miss!',
      type: 'attack',
      timestamp: ts,
    });
  });

  it('formats ENTITY_DIED showing name', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ENTITY_DIED',
      entityId: entityId('e1'),
      killerId: entityId('p1'),
      entityName: 'Goblin',
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Goblin is defeated!',
      type: 'death',
      timestamp: ts,
    });
  });

  it('formats PLAYER_DIED showing cause', () => {
    const event: DomainEvent = {
      ...base,
      type: 'PLAYER_DIED',
      killerId: entityId('e1'),
      killerName: 'Goblin',
      killerSpriteName: 'goblin-archer',
      floor: 3,
      cause: 'a goblin attack',
      goldLost: 100,
      overkillDamage: 5,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'You have fallen. a goblin attack',
      type: 'death',
      timestamp: ts,
    });
  });

  it('formats LOOT_ACQUIRED showing item name', () => {
    const event: DomainEvent = {
      ...base,
      type: 'LOOT_ACQUIRED',
      itemId: entityId('item1'),
      itemName: 'Gold Coin',
      playerId: entityId('p1'),
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Picked up Gold Coin!',
      type: 'loot',
      timestamp: ts,
    });
  });

  it('formats LEVEL_UP showing new level and stat gains', () => {
    const event: DomainEvent = {
      ...base,
      type: 'LEVEL_UP',
      playerId: entityId('p1'),
      newLevel: 3,
      statGains: { maxHealth: 10, attack: 2, defense: 1, accuracy: 1, evasion: 1 },
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Level up! Now level 3. (+10 HP, +2 ATK, +1 DEF)',
      type: 'info',
      timestamp: ts,
    });
  });

  it('returns null for PLAYER_MOVED', () => {
    const event: DomainEvent = {
      ...base,
      type: 'PLAYER_MOVED',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
    };
    expect(formatEvent(event)).toBeNull();
  });

  it('formats STATUS_APPLIED showing statusId and duration', () => {
    const event: DomainEvent = {
      ...base,
      type: 'STATUS_APPLIED',
      targetId: entityId('e1'),
      statusId: 'poison',
      duration: 3,
      sourceId: entityId('p1'),
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Poison applied for 3 turns.',
      type: 'status',
      timestamp: ts,
    });
  });

  it('formats STATUS_EXPIRED showing statusId', () => {
    const event: DomainEvent = {
      ...base,
      type: 'STATUS_EXPIRED',
      targetId: entityId('p1'),
      statusId: 'bleed',
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Bleed has worn off.',
      type: 'status',
      timestamp: ts,
    });
  });

  it('formats ABILITY_USED with heal', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ABILITY_USED',
      playerId: entityId('p1'),
      abilityId: 'second_wind',
      abilityName: 'Second Wind',
      hit: true,
      healAmount: 25,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Second Wind! Restored 25 HP.',
      type: 'info',
      timestamp: ts,
    });
  });

  it('formats ABILITY_USED with target damage', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ABILITY_USED',
      playerId: entityId('p1'),
      abilityId: 'power_strike',
      abilityName: 'Power Strike',
      targetId: entityId('e1'),
      targetName: 'Goblin',
      hit: true,
      damage: 42,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Power Strike! 42 damage to Goblin.',
      type: 'attack',
      timestamp: ts,
    });
  });

  it('formats ABILITY_USED misses without showing zero damage', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ABILITY_USED',
      playerId: entityId('p1'),
      abilityId: 'ember',
      abilityName: 'Ember',
      targetId: entityId('e1'),
      targetName: 'Cave Rat',
      hit: false,
      damage: 0,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Ember! Missed Cave Rat.',
      type: 'attack',
      timestamp: ts,
    });
  });

  it('formats QUEST_COMPLETED showing title and gold', () => {
    const event: DomainEvent = {
      ...base,
      type: 'QUEST_COMPLETED',
      questId: entityId('q1'),
      questTitle: 'Slay the Dragon',
      rewardGold: 100,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Quest complete: "Slay the Dragon"! Reward: 100g',
      type: 'loot',
      timestamp: ts,
    });
  });

  it('formats EQUIPMENT_DROPPED showing floor', () => {
    const event: DomainEvent = {
      ...base,
      type: 'EQUIPMENT_DROPPED',
      items: [{ slot: 'weapon', itemName: 'Iron Sword' }],
      floor: 3,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Your equipment was scattered on floor 3!',
      type: 'info',
      timestamp: ts,
    });
  });

  it('formats EQUIPMENT_RECOVERED showing floor', () => {
    const event: DomainEvent = {
      ...base,
      type: 'EQUIPMENT_RECOVERED',
      items: [{ slot: 'weapon', itemName: 'Iron Sword' }],
      floor: 3,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'You recovered your gear from floor 3!',
      type: 'loot',
      timestamp: ts,
    });
  });

  it('formats PERMADEATH showing floor', () => {
    const event: DomainEvent = {
      ...base,
      type: 'PERMADEATH',
      killerId: entityId('e1'),
      floor: 4,
      overkillDamage: 50,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Overkill! You have been permanently slain on floor 4. There is no coming back.',
      type: 'death',
      timestamp: ts,
    });
  });

  it('formats GOLD_CHANGED showing gain', () => {
    const event: DomainEvent = {
      ...base,
      type: 'GOLD_CHANGED',
      playerId: entityId('p1'),
      amount: 15,
      newTotal: 65,
      reason: 'enemy drop',
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Gained 15 gold. (enemy drop)',
      type: 'loot',
      timestamp: ts,
    });
  });

  it('formats FACTION_LEADER_EMERGED with readable leader text', () => {
    const event: DomainEvent = {
      ...base,
      type: 'FACTION_LEADER_EMERGED',
      factionId: 'goblin_warband',
      factionName: 'Goblin Warband',
      leaderId: entityId('goblin_warband_leader'),
      leaderName: 'Brakka',
      leaderTitle: 'Knife-King',
      leaderTemplateId: 'goblin_warlord',
      emergedOnRun: 2,
      emergedOnDepth: 3,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'Brakka, Knife-King, now leads the Goblin Warband.',
      type: 'info',
      timestamp: ts,
    });
  });

  it('formats DUNGEON_OGRE_EMERGED with selected depth details', () => {
    const event: DomainEvent = {
      ...base,
      type: 'DUNGEON_OGRE_EMERGED',
      ogreId: 'dungeon_ogre',
      emergedAfterRun: 4,
      emergedAtDepth: 6,
      eligibleSpawnDepths: [7, 8, 9],
      selectedSpawnDepth: 8,
    };
    const result = formatEvent(event);
    expect(result).toEqual({
      text: 'The Dungeon Ogre stirs below. It has claimed floor 8 from depths 7, 8, 9.',
      type: 'info',
      timestamp: ts,
    });
  });
});

describe('event format coverage guardrail', () => {
  // Non-silent events: must return a non-null result

  it('formats FLOOR_ENTERED showing depth', () => {
    const event: DomainEvent = {
      ...base,
      type: 'FLOOR_ENTERED',
      depth: 2,
      biomeId: 'crypt',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Entered floor 2.');
    expect(result!.type).toBe('info');
  });

  it('formats ITEM_USED showing item name', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ITEM_USED',
      itemId: entityId('item1'),
      itemName: 'Health Potion',
      userId: entityId('p1'),
      effect: 'heal',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Used Health Potion.');
    expect(result!.type).toBe('info');
  });

  it('formats ENEMY_ALERTED showing enemy name', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ENEMY_ALERTED',
      enemyId: entityId('e1'),
      enemyName: 'Troll',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Troll notices you!');
    expect(result!.type).toBe('info');
  });

  it('formats MOVEMENT_BLOCKED using the event message', () => {
    const event: DomainEvent = {
      ...base,
      type: 'MOVEMENT_BLOCKED',
      playerId: entityId('p1'),
      from: { x: 0, y: 0 },
      attemptedTo: { x: 0, y: 1 },
      direction: 'N',
      reasonCode: 'NOT_WALKABLE',
      message: 'That way is blocked.',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('That way is blocked.');
    expect(result!.type).toBe('info');
  });

  it('formats MOVEMENT_BLOCKED with a fallback when message is empty', () => {
    const event: DomainEvent = {
      ...base,
      type: 'MOVEMENT_BLOCKED',
      playerId: entityId('p1'),
      from: { x: 0, y: 0 },
      attemptedTo: { x: -1, y: 0 },
      direction: 'W',
      reasonCode: 'OUT_OF_BOUNDS',
      message: '',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text.length).toBeGreaterThan(0);
  });

  it('formats LOOT_DROPPED showing item and enemy name', () => {
    const event: DomainEvent = {
      ...base,
      type: 'LOOT_DROPPED',
      itemId: 'sword_01',
      itemName: 'Iron Sword',
      enemyName: 'Skeleton',
      reason: 'inventory_full',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Inventory full — Iron Sword from Skeleton was lost.');
    expect(result!.type).toBe('loot');
  });

  it('formats MASTERY_UNLOCKED showing ability and weapon type', () => {
    const event: DomainEvent = {
      ...base,
      type: 'MASTERY_UNLOCKED',
      playerId: entityId('p1'),
      weaponType: 'blade',
      tier: 1,
      abilityId: 'blade_dance',
      abilityName: 'Blade Dance',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Mastery unlocked: Blade Dance (blade Tier 1)!');
    expect(result!.type).toBe('info');
  });

  it('formats ENCHANTMENT_APPLIED showing item and enchantment name', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ENCHANTMENT_APPLIED',
      playerId: entityId('p1'),
      itemId: entityId('item1'),
      itemName: 'Iron Sword',
      enchantmentId: 'flaming',
      enchantmentName: 'Flaming',
      slot: 'weapon',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Enchanted Iron Sword with Flaming!');
    expect(result!.type).toBe('info');
  });

  it('formats BLUEPRINT_UNLOCKED showing blueprint ids', () => {
    const event: DomainEvent = {
      ...base,
      type: 'BLUEPRINT_UNLOCKED',
      playerId: entityId('p1'),
      blueprintIds: ['shield_of_thorns', 'helm_of_vigor'],
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Blueprints unlocked: shield_of_thorns, helm_of_vigor');
    expect(result!.type).toBe('info');
  });

  // Silent events: must return null

  it('returns null for ENEMY_MOVED', () => {
    const event: DomainEvent = {
      ...base,
      type: 'ENEMY_MOVED',
      enemyId: entityId('e1'),
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
    };
    expect(formatEvent(event)).toBeNull();
  });

  it('returns null for PHASE_CHANGED', () => {
    const event: DomainEvent = {
      ...base,
      type: 'PHASE_CHANGED',
      from: 'town',
      to: 'dungeon',
    };
    expect(formatEvent(event)).toBeNull();
  });

  it('returns null for RUN_STARTED', () => {
    const event: DomainEvent = {
      ...base,
      type: 'RUN_STARTED',
      runId: entityId('run1'),
    };
    expect(formatEvent(event)).toBeNull();
  });

  it('returns null for RUN_ENDED', () => {
    const event: DomainEvent = {
      ...base,
      type: 'RUN_ENDED',
      runId: entityId('run1'),
      reason: 'victory',
      floorsCleared: 5,
    };
    expect(formatEvent(event)).toBeNull();
  });

  it('returns null for TOWN_STATE_CHANGED', () => {
    const event: DomainEvent = {
      ...base,
      type: 'TOWN_STATE_CHANGED',
      field: 'blacksmithLevel',
      oldValue: 1,
      newValue: 2,
    };
    expect(formatEvent(event)).toBeNull();
  });

  it('B4: formats SHOP_TIER_UNLOCKED event', () => {
    const event: DomainEvent = {
      ...base,
      type: 'SHOP_TIER_UNLOCKED',
      unlockedTier: 'uncommon',
      triggerRarity: 'epic',
    };
    const result = formatEvent(event);
    expect(result).not.toBeNull();
    expect(result?.text).toContain('uncommon');
    expect(result?.type).toBe('info');
  });
});

describe('formatEvents', () => {
  it('filters out null entries', () => {
    const events: DomainEvent[] = [
      {
        ...base,
        type: 'ATTACK_PERFORMED',
        attackerId: entityId('p1'),
        defenderId: entityId('e1'),
        attackerName: 'Adventurer',
        defenderName: 'Goblin',
        damage: 10,
        damageType: 'physical',
        hit: true,
        critical: false,
        position: { x: 10, y: 10 },
      },
      {
        ...base,
        type: 'PLAYER_MOVED',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
      },
      {
        ...base,
        type: 'LOOT_ACQUIRED',
        itemId: entityId('item1'),
        itemName: 'Sword',
        playerId: entityId('p1'),
      },
    ];
    const formatted = formatEvents(events);
    expect(formatted).toHaveLength(2);
    expect(formatted[0]!.text).toContain('10 physical damage');
    expect(formatted[1]!.text).toContain('Sword');
  });

  // ---------------------------------------------------------------------------
  // Enchantment Effect Formatting Tests
  // ---------------------------------------------------------------------------

  it('formats THORNS_REFLECTED event', () => {
    const event: DomainEvent = {
      ...base,
      type: 'THORNS_REFLECTED',
      targetId: entityId('e1'),
      targetName: 'Skeleton Warrior',
      damageAmount: 8,
      byPlayerId: entityId('p1'),
      position: { x: 10, y: 10 },
    };
    const result = formatEvent(event);
    expect(result).toBeDefined();
    expect(result?.text).toContain('Thorns');
    expect(result?.text).toContain('Skeleton Warrior');
    expect(result?.text).toContain('8');
    expect(result?.type).toBe('attack');
  });

  it('formats BLINK_DODGED event', () => {
    const event: DomainEvent = {
      ...base,
      type: 'BLINK_DODGED',
      defenderId: entityId('p1'),
      attackerId: entityId('e1'),
      attackerName: 'Cave Rat',
    };
    const result = formatEvent(event);
    expect(result).toBeDefined();
    expect(result?.text).toContain('Cave Rat');
    expect(result?.text).toContain('glances off');
    expect(result?.type).toBe('info');
  });

  it('formats LIFE_STEAL event', () => {
    const event: DomainEvent = {
      ...base,
      type: 'LIFE_STEAL',
      playerId: entityId('p1'),
      enemyId: entityId('e1'),
      enemyName: 'Fire Elemental',
      hpRestored: 12,
    };
    const result = formatEvent(event);
    expect(result).toBeDefined();
    expect(result?.text).toContain('Life Steal');
    expect(result?.text).toContain('12');
    expect(result?.text).toContain('Fire Elemental');
    expect(result?.type).toBe('loot');
  });

  describe('Debug Events', () => {
    it('formats DEBUG_MISS_STREAK showing streak details', () => {
      const event: DomainEvent = {
        ...base,
        type: 'DEBUG_MISS_STREAK',
        streakLength: 6,
        playerAccuracy: 50,
        playerEvasion: 20,
        enemyAccuracy: 45,
        enemyEvasion: 15,
        rngSeed: 12345,
      };
      const result = formatEvent(event);
      expect(result).not.toBeNull();
      expect(result!.text).toContain('[DEBUG]');
      expect(result!.text).toContain('Miss streak of 6');
      expect(result!.text).toContain('pAcc:50');
      expect(result!.text).toContain('pEva:20');
      expect(result!.text).toContain('eAcc:45');
      expect(result!.text).toContain('eEva:15');
      expect(result!.type).toBe('info');
    });

    it('formats ENEMY_AMBIENT_STATE_CHANGED showing state transition', () => {
      const event: DomainEvent = {
        ...base,
        type: 'ENEMY_AMBIENT_STATE_CHANGED',
        enemyId: entityId('e1'),
        oldState: 'roaming',
        newState: 'regrouping',
        reason: 'spotted_ally_in_danger',
      };
      const result = formatEvent(event);
      expect(result).not.toBeNull();
      expect(result!.text).toContain('[DEBUG]');
      expect(result!.text).toContain('e1');
      expect(result!.text).toContain('roaming');
      expect(result!.text).toContain('regrouping');
      expect(result!.text).toContain('spotted_ally_in_danger');
      expect(result!.type).toBe('info');
    });
  });

  describe('Exhaustiveness', () => {
    it('every DomainEvent type has a formatter (no silent undefined returns)', () => {
      // This test validates that the mapped type in event-formatter.ts
      // actually enforces completeness. It's a belt-and-braces check
      // that complements the TypeScript satisfies clause.

      // List of all event types that are expected to return null (silent events)
      const silentEventTypes = new Set([
        'PLAYER_MOVED',
        'ENEMY_MOVED',
        'RUN_STARTED',
        'RUN_ENDED',
        'PHASE_CHANGED',
        'TOWN_STATE_CHANGED',
        'ENEMY_SPAWNED',
      ]);

      // For each event type, create a stub and verify formatEvent returns something
      // (either a formatted entry or null for silent events, never undefined)
      const allEventTypes = [
        'ATTACK_PERFORMED',
        'ENTITY_DIED',
        'STATUS_APPLIED',
        'STATUS_EXPIRED',
        'LOOT_ACQUIRED',
        'GOLD_CHANGED',
        'FLOOR_ENTERED',
        'PLAYER_DIED',
        'ITEM_USED',
        'ENEMY_ALERTED',
        'LEVEL_UP',
        'LOOT_DROPPED',
        'QUEST_ASSIGNED',
        'QUEST_COMPLETED',
        'ABILITY_USED',
        'MASTERY_UNLOCKED',
        'ENCHANTMENT_APPLIED',
        'BLUEPRINT_UNLOCKED',
        'SHOP_TIER_UNLOCKED',
        'EQUIPMENT_DROPPED',
        'EQUIPMENT_RECOVERED',
        'PERMADEATH',
        'TREASURE_OPENED',
        'OBJECT_INTERACTED',
        'TRAP_TRIGGERED',
        'THORNS_REFLECTED',
        'BLINK_DODGED',
        'LIFE_STEAL',
        'DEBUG_MISS_STREAK',
        'DEBUG_DAMAGE_CALC',
        'ENEMY_AMBIENT_STATE_CHANGED',
        'MOVEMENT_BLOCKED',
        ...silentEventTypes,
      ];

      // Stub event factory for validation
      const createStubEvent = (type: string): DomainEvent => {
        const base = { timestamp: ts, turnNumber: 1 } as any;
        switch (type) {
          case 'PLAYER_MOVED':
            return { ...base, type, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } };
          case 'ENEMY_MOVED':
            return { ...base, type, enemyId: entityId('e1'), from: { x: 0, y: 0 }, to: { x: 1, y: 1 } };
          case 'ATTACK_PERFORMED':
            return { ...base, type, attackerId: entityId('p1'), defenderId: entityId('e1'), attackerName: 'A', defenderName: 'B', damage: 10, damageType: 'physical', hit: true, critical: false };
          case 'ENTITY_DIED':
            return { ...base, type, entityId: entityId('e1'), killerId: entityId('p1'), entityName: 'Enemy' };
          case 'STATUS_APPLIED':
            return { ...base, type, targetId: entityId('p1'), statusId: 'poisoned', duration: 3, sourceId: null };
          case 'STATUS_EXPIRED':
            return { ...base, type, targetId: entityId('p1'), statusId: 'poisoned' };
          case 'LOOT_ACQUIRED':
            return { ...base, type, itemName: 'Sword' };
          case 'GOLD_CHANGED':
            return { ...base, type, amount: 10, reason: 'kill' };
          case 'FLOOR_ENTERED':
            return { ...base, type, depth: 1 };
          case 'PLAYER_DIED':
            return { ...base, type, killerId: entityId('e1'), killerName: 'Goblin', killerSpriteName: 'goblin', floor: 5, cause: 'overkill', goldLost: 50, overkillDamage: 20 };
          case 'RUN_STARTED':
            return { ...base, type, runId: 'run-1' };
          case 'RUN_ENDED':
            return { ...base, type, runId: 'run-1', result: 'victory' };
          case 'PHASE_CHANGED':
            return { ...base, type, newPhase: 'dungeon' };
          case 'TOWN_STATE_CHANGED':
            return { ...base, type, stateChanges: {} };
          case 'ITEM_USED':
            return { ...base, type, itemName: 'Potion' };
          case 'ENEMY_ALERTED':
            return { ...base, type, enemyName: 'Goblin' };
          case 'ENEMY_AMBIENT_STATE_CHANGED':
            return { ...base, type, enemyId: entityId('e1'), oldState: 'idle', newState: 'alert', reason: 'spotted' };
          case 'LEVEL_UP':
            return { ...base, type, newLevel: 2, statGains: { maxHealth: 10, attack: 2, defense: 1 } };
          case 'LOOT_DROPPED':
            return { ...base, type, itemName: 'Sword', enemyName: 'Goblin' };
          case 'QUEST_ASSIGNED':
            return { ...base, type, questTitle: 'Quest', questDescription: 'Do something', giverNpcId: entityId('npc1') };
          case 'QUEST_COMPLETED':
            return { ...base, type, questTitle: 'Quest', rewardGold: 100, giverNpcId: entityId('npc1') };
          case 'ABILITY_USED':
            return { ...base, type, abilityName: 'Fireball', healAmount: undefined, targetName: undefined };
          case 'MASTERY_UNLOCKED':
            return { ...base, type, abilityName: 'Technique', weaponType: 'blade', tier: 1 };
          case 'ENCHANTMENT_APPLIED':
            return { ...base, type, itemName: 'Sword', enchantmentName: 'Flame' };
          case 'BLUEPRINT_UNLOCKED':
            return { ...base, type, blueprintIds: ['fire-enchant'] };
          case 'SHOP_TIER_UNLOCKED':
            return { ...base, type, unlockedTier: 'rare' };
          case 'EQUIPMENT_DROPPED':
            return { ...base, type, floor: 5 };
          case 'EQUIPMENT_RECOVERED':
            return { ...base, type, floor: 5 };
          case 'PERMADEATH':
            return { ...base, type, floor: 5 };
          case 'ENEMY_SPAWNED':
            return { ...base, type, enemyId: entityId('e1'), enemyName: 'Goblin', x: 5, y: 5 };
          case 'TREASURE_OPENED':
            return { ...base, type, itemCount: 3 };
          case 'OBJECT_INTERACTED':
            return { ...base, type, objectName: 'Pedestal', healthDelta: 0, gotLoot: false };
          case 'TRAP_TRIGGERED':
            return { ...base, type, trapName: 'Spikes', damage: 5 };
          case 'THORNS_REFLECTED':
            return { ...base, type, targetName: 'Enemy', damageAmount: 3 };
          case 'BLINK_DODGED':
            return { ...base, type, attackerName: 'Enemy' };
          case 'LIFE_STEAL':
            return { ...base, type, hpRestored: 5, enemyName: 'Goblin' };
          case 'DEBUG_MISS_STREAK':
            return { ...base, type, playerAccuracy: 50, playerEvasion: 20, enemyAccuracy: 45, enemyEvasion: 15, rngSeed: 123, streakLength: 3 };
          case 'DEBUG_DAMAGE_CALC':
            return { ...base, type, attackerId: entityId('p1'), defenderId: entityId('e1'), baseDamage: 10, defenderDefense: 5, finalDamage: 8 };
          case 'MOVEMENT_BLOCKED':
            return { ...base, type, playerId: entityId('p1'), from: { x: 0, y: 0 }, attemptedTo: { x: 0, y: 1 }, direction: 'N', reasonCode: 'NOT_WALKABLE', message: 'That way is blocked.' };
          default:
            throw new Error(`Unhandled event type in test: ${type}`);
        }
      };

      for (const eventType of allEventTypes) {
        const event = createStubEvent(eventType);
        const result = formatEvent(event);

        if (silentEventTypes.has(eventType)) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
          expect(result?.text).toBeTruthy();
          expect(result?.timestamp).toBe(ts);
        }
      }
    });
  });
});
