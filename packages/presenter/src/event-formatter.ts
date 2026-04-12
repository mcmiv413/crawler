import type { DomainEvent, EnemyAmbientStateChangedEvent } from '@dungeon/contracts';
import { STATUS_DEFINITIONS } from '@dungeon/content';
import type { CombatLogEntry } from './game-view.js';

/** Format domain events into human-readable combat log entries */
export function formatEvent(event: DomainEvent): CombatLogEntry | null {
  switch (event.type) {
    case 'ATTACK_PERFORMED':
      if (event.hit) {
        const critText = event.critical ? ' CRIT!' : '';
        return {
          text: `[${event.attackerName} -> ${event.defenderName}] ${event.damage} ${event.damageType} dmg${critText}`,
          type: 'attack',
          timestamp: event.timestamp,
        };
      }
      // Determine miss message based on missReason (evasion vs accuracy)
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

    case 'ENTITY_DIED':
      return {
        text: `${event.entityName} is defeated!`,
        type: 'death',
        timestamp: event.timestamp,
      };

    case 'PLAYER_DIED':
      return {
        text: `You have fallen. ${event.cause}`,
        type: 'death',
        timestamp: event.timestamp,
      };

    case 'STATUS_APPLIED': {
      const statusName = STATUS_DEFINITIONS[event.statusId]?.name ?? event.statusId;
      return {
        text: `${statusName} applied for ${event.duration} turns.`,
        type: 'status',
        timestamp: event.timestamp,
      };
    }

    case 'STATUS_EXPIRED': {
      const statusName = STATUS_DEFINITIONS[event.statusId]?.name ?? event.statusId;
      return {
        text: `${statusName} has worn off.`,
        type: 'status',
        timestamp: event.timestamp,
      };
    }

    case 'LOOT_ACQUIRED':
      return {
        text: `Picked up ${event.itemName}!`,
        type: 'loot',
        timestamp: event.timestamp,
      };

    case 'GOLD_CHANGED': {
      const verb = event.amount > 0 ? 'Gained' : 'Lost';
      return {
        text: `${verb} ${Math.abs(event.amount)} gold. (${event.reason})`,
        type: 'loot',
        timestamp: event.timestamp,
      };
    }

    case 'FLOOR_ENTERED':
      return {
        text: `Entered floor ${event.depth}.`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'ITEM_USED':
      return {
        text: `Used ${event.itemName}.`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'ENEMY_ALERTED':
      return {
        text: `${event.enemyName} notices you!`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'LEVEL_UP':
      return {
        text: `Level up! Now level ${event.newLevel}. (+${event.statGains.maxHealth} HP, +${event.statGains.attack} ATK, +${event.statGains.defense} DEF)`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'NEMESIS_ENCOUNTERED':
      return {
        text: `⚠ ${event.nemesisName} has found you!`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'NEMESIS_PROMOTED':
      return {
        text: `A nemesis rises: ${event.nemesisName} — a new threat lurks in the dungeon!`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'NEMESIS_SLAIN': {
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
    }

    case 'LOOT_DROPPED':
      return {
        text: `Inventory full — ${event.itemName} from ${event.enemyName} was lost.`,
        type: 'loot',
        timestamp: event.timestamp,
      };

    case 'QUEST_ASSIGNED':
      return {
        text: `New quest: \"${event.questTitle}\" • ${event.questDescription}`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'QUEST_COMPLETED':
      return {
        text: `Quest complete: \"${event.questTitle}\"! Reward: ${event.rewardGold}g`,
        type: 'loot',
        timestamp: event.timestamp,
      };

    case 'ABILITY_USED':
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

    case 'MASTERY_UNLOCKED':
      return {
        text: `Mastery unlocked: ${event.abilityName} (${event.weaponType} Tier ${event.tier})!`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'ENCHANTMENT_APPLIED':
      return {
        text: `Enchanted ${event.itemName} with ${event.enchantmentName}!`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'BLUEPRINT_UNLOCKED':
      return {
        text: `Blueprint${event.blueprintIds.length > 1 ? 's' : ''} unlocked: ${event.blueprintIds.join(', ')}`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'EQUIPMENT_DROPPED':
      return {
        text: `Your equipment was scattered on floor ${event.floor}!`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'EQUIPMENT_RECOVERED':
      return {
        text: `You recovered your gear from floor ${event.floor}!`,
        type: 'loot',
        timestamp: event.timestamp,
      };

    case 'PERMADEATH':
      return {
        text: `Overkill! You have been permanently slain on floor ${event.floor}. There is no coming back.`,
        type: 'death',
        timestamp: event.timestamp,
      };

    case 'SHOP_TIER_UNLOCKED':
      return {
        text: `New items available at the shop! (${event.unlockedTier} tier unlocked)`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'TREASURE_OPENED':
      return {
        text: `Opened treasure chest! Found ${event.itemCount} item${event.itemCount > 1 ? 's' : ''}.`,
        type: 'loot',
        timestamp: event.timestamp,
      };

    case 'OBJECT_INTERACTED': {
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
    }

    case 'THORNS_REFLECTED':
      return {
        text: `Thorns: ${event.targetName} takes ${event.damageAmount} damage!`,
        type: 'attack',
        timestamp: event.timestamp,
      };

    case 'BLINK_DODGED':
      return {
        text: `${event.attackerName}'s attack glances off!`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'LIFE_STEAL':
      return {
        text: `Life Steal: Restored ${event.hpRestored} HP from ${event.enemyName}'s defeat!`,
        type: 'loot',
        timestamp: event.timestamp,
      };

    case 'DEBUG_MISS_STREAK':
      return {
        text: `[DEBUG] Miss streak of ${event.streakLength}! pAcc:${event.playerAccuracy} pEva:${event.playerEvasion} eAcc:${event.enemyAccuracy} eEva:${event.enemyEvasion} seed:${event.rngSeed}`,
        type: 'info',
        timestamp: event.timestamp,
      };

    case 'ENEMY_AMBIENT_STATE_CHANGED': {
      const ambientEvent = event as EnemyAmbientStateChangedEvent;
      return {
        text: `[DEBUG] ${ambientEvent.enemyId} state: ${ambientEvent.oldState} → ${ambientEvent.newState} (${ambientEvent.reason})`,
        type: 'info',
        timestamp: event.timestamp,
      };
    }

    case 'PLAYER_MOVED':
    case 'ENEMY_MOVED':
    case 'PHASE_CHANGED':
    case 'RUN_STARTED':
    case 'RUN_ENDED':
    case 'TOWN_STATE_CHANGED':
    case 'ENEMY_SPAWNED':
      return null; // Not shown in combat log

    // Fallback for unknown event types (should not happen at runtime)
    default:
      return null;
  }
}

/** Format multiple events, filtering out nulls */
export function formatEvents(events: readonly DomainEvent[]): CombatLogEntry[] {
  return events.map(formatEvent).filter((e): e is CombatLogEntry => e !== null);
}
