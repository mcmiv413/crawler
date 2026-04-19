import type { DomainEvent, EnemyAmbientStateChangedEvent } from '@dungeon/contracts';
import { STATUS_DEFINITIONS } from '@dungeon/content';
import type { CombatLogEntry } from './game-view.js';

/**
 * Mapped type for event formatters.
 * Ensures every DomainEvent type has a corresponding formatter with proper typing.
 * TypeScript will report an error if a handler is missing or has the wrong signature.
 */
type EventFormatterMap = {
  [K in DomainEvent['type']]: (event: Extract<DomainEvent, { type: K }>) => CombatLogEntry | null;
};

/** Table of event formatters by event type */
const EVENT_FORMATTERS = {
  'ATTACK_PERFORMED': (event) => {
    if (event.hit) {
      const critText = event.critical ? ' CRIT!' : '';
      return {
        text: `[${event.attackerName} -> ${event.defenderName}] ${event.damage} ${event.damageType} dmg${critText}`,
        type: 'attack',
        timestamp: event.timestamp,
      };
    }
    let missText = 'Miss!';
    if (event.missReason === 'evasion') {
      missText = `${event.defenderName} dodged!`;
    } else if (event.missReason === 'accuracy') {
      missText = 'Attack missed!';
    }
    return {
      text: `[${event.attackerName} -> ${event.defenderName}] ${missText}`,
      type: 'attack',
      timestamp: event.timestamp,
    };
  },

  'ENTITY_DIED': (event) => ({
    text: `${event.entityName} is defeated!`,
    type: 'death',
    timestamp: event.timestamp,
  }),

  'PLAYER_DIED': (event) => ({
    text: `You have fallen. ${event.cause}`,
    type: 'death',
    timestamp: event.timestamp,
  }),

  'STATUS_APPLIED': (event) => {
    const statusName = STATUS_DEFINITIONS[event.statusId]?.name ?? event.statusId;
    return {
      text: `${statusName} applied for ${event.duration} turns.`,
      type: 'status',
      timestamp: event.timestamp,
    };
  },

  'STATUS_EXPIRED': (event) => {
    const statusName = STATUS_DEFINITIONS[event.statusId]?.name ?? event.statusId;
    return {
      text: `${statusName} has worn off.`,
      type: 'status',
      timestamp: event.timestamp,
    };
  },

  'LOOT_ACQUIRED': (event) => ({
    text: `Picked up ${event.itemName}!`,
    type: 'loot',
    timestamp: event.timestamp,
  }),

  'GOLD_CHANGED': (event) => {
    const verb = event.amount > 0 ? 'Gained' : 'Lost';
    return {
      text: `${verb} ${Math.abs(event.amount)} gold. (${event.reason})`,
      type: 'loot',
      timestamp: event.timestamp,
    };
  },

  'FLOOR_ENTERED': (event) => ({
    text: `Entered floor ${event.depth}.`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'ITEM_USED': (event) => ({
    text: `Used ${event.itemName}.`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'ENEMY_ALERTED': (event) => ({
    text: `${event.enemyName} notices you!`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'LEVEL_UP': (event) => ({
    text: `Level up! Now level ${event.newLevel}. (+${event.statGains.maxHealth} HP, +${event.statGains.attack} ATK, +${event.statGains.defense} DEF)`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'NEMESIS_ENCOUNTERED': (event) => ({
    text: `⚠ ${event.nemesisName} has found you!`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'NEMESIS_PROMOTED': (event) => ({
    text: `A nemesis rises: ${event.nemesisName} — a new threat lurks in the dungeon!`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'NEMESIS_SLAIN': (event) => {
    const parts: string[] = [
      `☠ ${event.nemesisName} has been vanquished!`,
      ...(event.lootItemName ? [`Drops: ${event.lootItemName}`] : []),
      ...(event.blueprintUnlocked ? [`Enchantment unlocked: ${event.blueprintUnlocked}`] : []),
    ];
    return {
      text: parts.join(' · '),
      type: 'death',
      timestamp: event.timestamp,
    };
  },

  'LOOT_DROPPED': (event) => ({
    text: `Inventory full — ${event.itemName} from ${event.enemyName} was lost.`,
    type: 'loot',
    timestamp: event.timestamp,
  }),

  'QUEST_ASSIGNED': (event) => ({
    text: `New quest: \"${event.questTitle}\" • ${event.questDescription}`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'QUEST_COMPLETED': (event) => ({
    text: `Quest complete: \"${event.questTitle}\"! Reward: ${event.rewardGold}g`,
    type: 'loot',
    timestamp: event.timestamp,
  }),

  'ABILITY_USED': (event) => {
    if (event.healAmount !== undefined) {
      return {
        text: `${event.abilityName}! Restored ${event.healAmount} HP.`,
        type: 'info',
        timestamp: event.timestamp,
      };
    }
    if (event.targetName !== undefined) {
      return {
        text: `${event.abilityName}! ${event.damage ?? 0} damage to ${event.targetName}.`,
        type: 'attack',
        timestamp: event.timestamp,
      };
    }
    return { text: `Used ${event.abilityName}!`, type: 'info', timestamp: event.timestamp };
  },

  'MASTERY_UNLOCKED': (event) => ({
    text: `Mastery unlocked: ${event.abilityName} (${event.weaponType} Tier ${event.tier})!`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'ENCHANTMENT_APPLIED': (event) => ({
    text: `Enchanted ${event.itemName} with ${event.enchantmentName}!`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'BLUEPRINT_UNLOCKED': (event) => ({
    text: `Blueprint${event.blueprintIds.length > 1 ? 's' : ''} unlocked: ${event.blueprintIds.join(', ')}`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'EQUIPMENT_DROPPED': (event) => ({
    text: `Your equipment was scattered on floor ${event.floor}!`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'EQUIPMENT_RECOVERED': (event) => ({
    text: `You recovered your gear from floor ${event.floor}!`,
    type: 'loot',
    timestamp: event.timestamp,
  }),

  'PERMADEATH': (event) => ({
    text: `Overkill! You have been permanently slain on floor ${event.floor}. There is no coming back.`,
    type: 'death',
    timestamp: event.timestamp,
  }),

  'SHOP_TIER_UNLOCKED': (event) => ({
    text: `New items available at the shop! (${event.unlockedTier} tier unlocked)`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'TREASURE_OPENED': (event) => ({
    text: `Opened treasure chest! Found ${event.itemCount} item${event.itemCount > 1 ? 's' : ''}.`,
    type: 'loot',
    timestamp: event.timestamp,
  }),

  'OBJECT_INTERACTED': (event) => {
    let message = `Interacted with ${event.objectName}.`;
    if (event.healthDelta > 0) {
      message += ` Healed ${event.healthDelta} HP!`;
    } else if (event.healthDelta < 0) {
      message += ` Took ${Math.abs(event.healthDelta)} damage!`;
    }
    if (event.gotLoot) {
      message += ` Found loot!`;
    }
    return {
      text: message,
      type: event.healthDelta > 0 ? 'loot' : (event.healthDelta < 0 ? 'damage' : 'info'),
      timestamp: event.timestamp,
    };
  },

  'TRAP_TRIGGERED': (event) => ({
    text: `${event.trapName} dealt ${event.damage} damage!`,
    type: 'damage',
    timestamp: event.timestamp,
  }),

  'THORNS_REFLECTED': (event) => ({
    text: `Thorns: ${event.targetName} takes ${event.damageAmount} damage!`,
    type: 'attack',
    timestamp: event.timestamp,
  }),

  'BLINK_DODGED': (event) => ({
    text: `${event.attackerName}'s attack glances off!`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'LIFE_STEAL': (event) => ({
    text: `Life Steal: Restored ${event.hpRestored} HP from ${event.enemyName}'s defeat!`,
    type: 'loot',
    timestamp: event.timestamp,
  }),

  'DEBUG_MISS_STREAK': (event) => ({
    text: `[DEBUG] Miss streak of ${event.streakLength}! pAcc:${event.playerAccuracy} pEva:${event.playerEvasion} eAcc:${event.enemyAccuracy} eEva:${event.enemyEvasion} seed:${event.rngSeed}`,
    type: 'info',
    timestamp: event.timestamp,
  }),

  'DEBUG_DAMAGE_CALC': (event) => {
    let breakdown = `base:${event.rawDamage}`;

    if (event.isCrit && event.critMultiplier !== 1) {
      const postCrit = Math.round(event.rawDamage * event.critMultiplier);
      breakdown += ` crit:×${event.critMultiplier}→${postCrit}`;
    }

    // Always show defense step if not bypassed (even if 0)
    if (!event.bypassDefense) {
      const defReduction = event.rawDamage - event.postDefense;
      if (defReduction !== 0) {
        breakdown += ` def:-${defReduction}→${event.postDefense}`;
      } else {
        breakdown += ` def:0→${event.postDefense}`;
      }
    }

    // Always show resistance step if not bypassed (even if 0)
    if (!event.bypassResistance) {
      if (event.resistance > 0) {
        const resMultiplier = (1 - event.resistance).toFixed(2);
        breakdown += ` res:×${resMultiplier}→${event.postResistance}`;
      } else {
        // No resistance, but show the step for clarity
        breakdown += ` res:×1.00→${event.postResistance}`;
      }
    }

    return {
      text: `[DEBUG] ${event.targetName} took ${event.finalDamage} dmg\n  ${breakdown}`,
      type: 'info',
      timestamp: event.timestamp,
    };
  },

  'ENEMY_AMBIENT_STATE_CHANGED': (event) => {
    const ambientEvent = event as EnemyAmbientStateChangedEvent;
    return {
      text: `[DEBUG] ${ambientEvent.enemyId} state: ${ambientEvent.oldState} → ${ambientEvent.newState} (${ambientEvent.reason})`,
      type: 'info',
      timestamp: event.timestamp,
    };
  },

  'PLAYER_MOVED': () => null,
  'ENEMY_MOVED': () => null,
  'PHASE_CHANGED': () => null,
  'RUN_STARTED': () => null,
  'RUN_ENDED': () => null,
  'TOWN_STATE_CHANGED': () => null,
  'ENEMY_SPAWNED': () => null,
} satisfies EventFormatterMap;

/** Format domain events into human-readable combat log entries */
export function formatEvent(event: DomainEvent): CombatLogEntry | null {
  // Safe type assertion: at runtime, event.type is always a valid key
  // The satisfies EventFormatterMap above guarantees all event types have handlers
  const formatter = EVENT_FORMATTERS[event.type] as (e: DomainEvent) => CombatLogEntry | null;
  return formatter(event);
}

/** Format multiple events, filtering out nulls */
export function formatEvents(events: readonly DomainEvent[]): CombatLogEntry[] {
  return events.map(formatEvent).filter((e): e is CombatLogEntry => e !== null);
}
