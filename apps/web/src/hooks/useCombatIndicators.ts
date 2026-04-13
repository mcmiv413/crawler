import { useEffect, useRef } from 'react';
import { emitCombatIndicator } from '../components/CombatIndicators.js';

interface CombatLogEntry {
  text: string;
  type: string;
}

interface EntityView {
  id: string;
  x: number;
  y: number;
}

interface IndicatorContext {
  playerPos: { x: number; y: number };
  entities: Map<string, EntityView>;
}

/**
 * Hook that watches combat log entries and emits floating indicators
 * for damage, healing, and status effects on the dungeon canvas.
 * 
 * Parses combat log entries to extract position and value information.
 */
export function useCombatIndicators(
  entities: readonly EntityView[],
  combatLog: readonly CombatLogEntry[],
  playerPosition: { x: number; y: number },
): void {
  const previousLogLengthRef = useRef(combatLog.length);
  const contextRef = useRef<IndicatorContext>({
    playerPos: playerPosition,
    entities: new Map(),
  });

  // Update context when inputs change
  useEffect(() => {
    const map = new Map<string, EntityView>();
    for (const entity of entities) {
      map.set(entity.id, entity);
    }
    contextRef.current = {
      playerPos: playerPosition,
      entities: map,
    };
  }, [entities, playerPosition]);

  useEffect(() => {
    const currentLength = combatLog.length;
    const previousLength = previousLogLengthRef.current;

    // Process new log entries since last check
    if (currentLength > previousLength) {
      const newEntries = combatLog.slice(previousLength);
      const context = contextRef.current;

      for (const entry of newEntries) {
        parseAndEmitIndicators(entry, context);
      }
    }

    previousLogLengthRef.current = currentLength;
  }, [combatLog]);
}

/**
 * Parse combat log entry and emit floating indicators for recognized patterns.
 */
function parseAndEmitIndicators(entry: CombatLogEntry, context: IndicatorContext) {
  const text = entry.text;
  const { playerPos, entities } = context;

  // Pattern: "Player dealt 25 damage to Goblin" or similar
  // Show damage at target position
  const playerDamageMatch = text.match(/Player dealt (\d+) damage/i);
  if (playerDamageMatch) {
    const damage = playerDamageMatch[1];
    // Try to find a likely target - use first enemy
    const firstEnemy = Array.from(entities.values())[0];
    if (firstEnemy) {
      emitCombatIndicator(firstEnemy.x, firstEnemy.y, `-${damage}`, 'damage');
    }
    return;
  }

  // Pattern: "Goblin dealt 8 damage to Player" or similar
  // Show damage at player position
  const enemyDamageMatch = text.match(/.*? dealt (\d+) damage to Player/i);
  if (enemyDamageMatch) {
    const damage = enemyDamageMatch[1];
    emitCombatIndicator(playerPos.x, playerPos.y, `-${damage}`, 'damage');
    return;
  }

  // Pattern: "Player healed for 10" or similar
  const healMatch = text.match(/healed for (\d+)/i);
  if (healMatch) {
    const amount = healMatch[1];
    emitCombatIndicator(playerPos.x, playerPos.y, `+${amount}`, 'heal');
    return;
  }

  // Pattern: "Poisoned!" / "Stunned!" / "Slowed!" etc.
  // Show status indicator at player or relevant entity
  const statusMatch = text.match(/(Poisoned|Stunned|Slowed|Regenerating|Weakened|Bleeding|Protected)!/i);
  if (statusMatch) {
    const status = statusMatch[1];
    // If text mentions "Player was", show at player
    if (text.toLowerCase().includes('player')) {
      emitCombatIndicator(playerPos.x, playerPos.y, `${status}!`, 'status');
    } else {
      // Otherwise try to find the affected entity
      const firstEnemy = Array.from(entities.values())[0];
      if (firstEnemy) {
        emitCombatIndicator(firstEnemy.x, firstEnemy.y, `${status}!`, 'status');
      }
    }
    return;
  }
}
