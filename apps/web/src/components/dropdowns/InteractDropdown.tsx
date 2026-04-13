/**
 * InteractDropdown - Displays available interactive objects to interact with.
 */

import type { EntityView } from '@dungeon/presenter';
import styles from './ActionDropdowns.module.css';

export interface InteractDropdownProps {
  readonly objects: readonly EntityView[];
  readonly playerX: number;
  readonly playerY: number;
  readonly onSelect: (objectId: string) => void;
}

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function InteractDropdown({
  objects,
  playerX,
  playerY,
  onSelect,
}: InteractDropdownProps) {
  // Filter to only objects within range 1 (adjacent tiles)
  const adjacentObjects = objects.filter((obj) => {
    const distance = calculateDistance(playerX, playerY, obj.x, obj.y);
    return distance <= 1;
  });

  if (adjacentObjects.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No objects to interact with nearby (must be adjacent).</p>
      </div>
    );
  }

  // Sort by distance
  const sortedObjects = [...adjacentObjects].sort((a, b) => {
    const distA = calculateDistance(playerX, playerY, a.x, a.y);
    const distB = calculateDistance(playerX, playerY, b.x, b.y);
    return distA - distB;
  });

  return (
    <div className={styles.listContainer}>
      {sortedObjects.map((obj) => {
        const distance = calculateDistance(playerX, playerY, obj.x, obj.y);
        const objectType = getObjectType(obj.name);

        return (
          <button
            key={obj.id}
            className={styles.targetItem}
            onClick={() => onSelect(obj.id)}
          >
            <div className={styles.targetName}>
              <span className={styles.objectIcon}>{obj.ascii}</span>
              <span>{obj.name}</span>
            </div>
            <div className={styles.targetStats}>
              <span className={styles.distance}>
                {objectType} • {distance} squares away
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getObjectType(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('chest') || nameLower.includes('treasure')) return '💰 Loot';
  if (nameLower.includes('fountain') || nameLower.includes('shrine')) return '⛲ Shrine';
  if (nameLower.includes('altar')) return '🙏 Altar';
  if (nameLower.includes('door') || nameLower.includes('gate')) return '🚪 Door';
  return '📦 Object';
}
