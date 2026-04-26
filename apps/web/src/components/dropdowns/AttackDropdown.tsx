/**
 * AttackDropdown - Displays available enemies to target and attack.
 * Only shows enemies within weapon range and outside minimum range.
 */

import type { EntityView, InspectableEntityView } from '@dungeon/presenter';
import styles from './ActionDropdowns.module.css';

export interface AttackDropdownProps {
  readonly enemies: readonly EntityView[];
  readonly inspectableEntities: readonly InspectableEntityView[];
  readonly playerX: number;
  readonly playerY: number;
  readonly weaponRange: number;
  readonly minRange?: number;  // For ranged weapons: minimum distance to target
  readonly onSelect: (enemyId: string) => void;
}

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function AttackDropdown({
  enemies,
  inspectableEntities,
  playerX,
  playerY,
  weaponRange,
  minRange = 0,
  onSelect,
}: AttackDropdownProps) {
  // Filter enemies to only those within weapon range and outside minimum range
  const inRangeEnemies = enemies.filter((enemy) => {
    const distance = calculateDistance(playerX, playerY, enemy.x, enemy.y);
    return distance <= weaponRange && distance >= (minRange || 0);
  });

  const tooCloseCount = enemies.filter((enemy) => {
    const distance = calculateDistance(playerX, playerY, enemy.x, enemy.y);
    return distance < (minRange || 0);
  }).length;

  if (inRangeEnemies.length === 0) {
    let message = 'No enemies in range.';
    if (tooCloseCount > 0) {
      message = `${tooCloseCount} ${tooCloseCount === 1 ? 'enemy is' : 'enemies are'} too close.`;
    }
    return (
      <div className={styles.emptyState}>
        <p>{message}</p>
        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#7a9ab0' }}>
          Range: {minRange ?? 0}-{weaponRange} {weaponRange === 1 ? 'tile' : 'tiles'}.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {inRangeEnemies.map((enemy) => {
        const distance = calculateDistance(playerX, playerY, enemy.x, enemy.y);
        const healthPercent = enemy.maxHealth ? (enemy.health ?? 0) / enemy.maxHealth * 100 : 0;
        const inspectableEntity = inspectableEntities.find((e) => e.id === enemy.id);
        const instanceColor = inspectableEntity?.instanceColor;

        return (
          <button
            key={enemy.id}
            className={styles.targetItem}
            onClick={() => onSelect(enemy.id)}
          >
            <div className={styles.targetName}>
              {instanceColor && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '1px',
                    backgroundColor: instanceColor,
                    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.4)',
                    marginRight: '6px',
                  }}
                />
              )}
              {enemy.nemesisName ? (
                <>
                  <span className={styles.nemesisBadge}>⭐</span>
                  <span>{enemy.nemesisName}</span>
                </>
              ) : (
                <span>{enemy.name}</span>
              )}
            </div>

            <div className={styles.targetStats}>
              <div className={styles.healthBar}>
                <div
                  className={styles.healthFill}
                  style={{ width: `${healthPercent}%` }}
                />
              </div>
              <div className={styles.statsRow}>
                <span className={styles.health}>
                  {enemy.health}/{enemy.maxHealth}
                </span>
                <span className={styles.distance}>
                  {distance} {distance === 1 ? 'tile' : 'tiles'} away
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
