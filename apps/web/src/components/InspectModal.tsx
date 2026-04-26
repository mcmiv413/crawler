/**
 * InspectModal - Full-screen overlay modal for inspecting entities
 * Shows entity list with sprites, and detailed information on selection
 * Covers action bar and combat log space
 */

import React, { useState } from 'react';
import type { InspectableEntityView } from '@dungeon/presenter';
import { EntitySpriteDisplay } from './EntitySpriteDisplay.js';
import styles from './InspectModal.module.css';

interface InspectModalProps {
  readonly entities: readonly InspectableEntityView[];
  readonly playerSpeed: number;
  readonly useSprites: boolean;
  readonly onClose: () => void;
}

export function InspectModal({
  entities,
  playerSpeed,
  useSprites,
  onClose,
}: InspectModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(entities[0]?.id ?? null);
  const selectedEntity = entities.find(e => e.id === selectedId);

  if (entities.length === 0) {
    return (
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h2 className={styles.title}>Inspect</h2>
            <button className={styles.closeButton} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <div className={styles.emptyState}>
            <p>Nothing visible to inspect.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Inspect</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Entity list on left */}
          <div className={styles.entityList}>
            {entities.map((entity) => (
              <button
                key={entity.id}
                className={`${styles.entityListItem} ${entity.id === selectedId ? styles.selected : ''}`}
                onClick={() => setSelectedId(entity.id)}
              >
                <div className={styles.listItemSprite}>
                  <EntitySpriteDisplay entity={entity} size="small" useSprites={useSprites} />
                </div>
                <div className={styles.listItemInfo}>
                  <div className={styles.entityNameRow}>
                    {entity.instanceColor && (
                      <span
                        className={styles.instanceColorSquare}
                        style={{
                          backgroundColor: entity.instanceColor,
                          boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.4)',
                        }}
                      />
                    )}
                    <span className={styles.entityName}>{entity.name}</span>
                  </div>
                  {entity.health !== undefined && (
                    <div className={styles.entityHealth}>
                      {entity.health}/{entity.maxHealth}
                    </div>
                  )}
                  {entity.threatRating && (
                    <div className={styles.entityThreat} data-threat={entity.threatRating}>
                      {entity.threatRating}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Details panel on right */}
          {selectedEntity && (
            <div className={styles.detailsPanel}>
              <div className={styles.spriteSection}>
                <EntitySpriteDisplay entity={selectedEntity} size="large" useSprites={useSprites} />
                <div className={styles.entityTitle}>{selectedEntity.name}</div>
              </div>

              <div className={styles.description}>{selectedEntity.description}</div>

              {selectedEntity.entityType === 'enemy' && (
                <>
                  {selectedEntity.threatRating && (
                    <div className={styles.threatSection}>
                      <div className={styles.threatLabel}>Threat Level</div>
                      <div className={styles.threatValue} data-threat={selectedEntity.threatRating}>
                        {selectedEntity.threatRating}
                      </div>
                    </div>
                  )}

                  {selectedEntity.health !== undefined && (
                    <div className={styles.statSection}>
                      <div className={styles.statLabel}>Health</div>
                      <div className={styles.statValue}>
                        {selectedEntity.health} / {selectedEntity.maxHealth}
                      </div>
                    </div>
                  )}

                  <div className={styles.statsGrid}>
                    {selectedEntity.attack !== undefined && (
                      <div className={styles.statBox}>
                        <div className={styles.statLabel}>ATK</div>
                        <div className={styles.statValue}>{selectedEntity.attack}</div>
                      </div>
                    )}
                    {selectedEntity.defense !== undefined && (
                      <div className={styles.statBox}>
                        <div className={styles.statLabel}>DEF</div>
                        <div className={styles.statValue}>{selectedEntity.defense}</div>
                      </div>
                    )}
                    {selectedEntity.speed !== undefined && (
                      <div className={styles.statBox}>
                        <div className={styles.statLabel}>SPD</div>
                        <div className={styles.statValue}>{selectedEntity.speed}</div>
                      </div>
                    )}
                    {selectedEntity.tier !== undefined && (
                      <div className={styles.statBox}>
                        <div className={styles.statLabel}>TIER</div>
                        <div className={styles.statValue}>{selectedEntity.tier}</div>
                      </div>
                    )}
                  </div>

                  {selectedEntity.isFasterThanPlayer !== undefined && (
                    <div className={styles.speedComparison}>
                      {selectedEntity.isFasterThanPlayer ? (
                        <>⚡ Faster than you</>
                      ) : (
                        <>✓ Slower than you</>
                      )}
                    </div>
                  )}

                  {(selectedEntity.playerHitChance !== undefined || selectedEntity.enemyHitChance !== undefined) && (
                    <div className={styles.hitChanceSection}>
                      {selectedEntity.playerHitChance !== undefined && (
                        <div className={styles.infoRow}>
                          <span className={styles.label}>Your hit chance:</span>
                          <span className={styles.value}>{selectedEntity.playerHitChance}%</span>
                        </div>
                      )}
                      {selectedEntity.enemyHitChance !== undefined && (
                        <div className={styles.infoRow}>
                          <span className={styles.label}>Their hit chance:</span>
                          <span className={styles.value}>{selectedEntity.enemyHitChance}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedEntity.archetype && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Type:</span>
                      <span className={styles.value}>{selectedEntity.archetype}</span>
                    </div>
                  )}

                  {selectedEntity.affinities && Object.keys(selectedEntity.affinities).length > 0 && (
                    <div className={styles.affinitiesSection}>
                      <div className={styles.sectionLabel}>Affinities</div>
                      <div className={styles.affinitiesList}>
                        {Object.entries(selectedEntity.affinities).map(([damageType, value]) => (
                          <div key={damageType} className={styles.affinityRow}>
                            <span className={styles.affinityType}>{damageType}</span>
                            <span className={`${styles.affinityValue} ${value > 0 ? styles.resistance : value < 0 ? styles.vulnerability : ''}`}>
                              {value > 0 ? '+' : ''}{value}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedEntity.statuses && selectedEntity.statuses.length > 0 && (
                    <div className={styles.statusesSection}>
                      <div className={styles.sectionLabel}>Status Effects</div>
                      <div className={styles.statusesList}>
                        {selectedEntity.statuses.map((status, idx) => (
                          <div key={`${status}-${idx}`} className={styles.statusItem}>
                            {status}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedEntity.entityType === 'object' && (
                <>
                  {selectedEntity.description && (
                    <div className={styles.infoRow}>
                      <span className={styles.value}>{selectedEntity.description}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
