import React, { useState } from 'react';
import type { FactionStanding } from '@dungeon/presenter';
import { colors, FONT_STACK, btnStyle } from '../styles.js';
import { ModalBackdrop, ModalCard, SectionLabel } from './ui/index.js';

interface FactionDetailModalProps {
  factions: readonly FactionStanding[];
  onClose: () => void;
}

function standingColor(standing: number): string {
  if (standing > 100) return colors.lime;
  if (standing < 100) return colors.blood;
  return colors.gold;
}

export function FactionDetailModal({ factions, onClose }: FactionDetailModalProps) {
  const [selectedFactionId, setSelectedFactionId] = useState<string>(
    factions.length > 0 ? factions[0]!.factionId : '',
  );
  const selectedFaction = selectedFactionId
    ? factions.find((f) => f.factionId === selectedFactionId)
    : null;

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="FACTIONS" onClose={onClose} accentColor={colors.lime}>
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {/* Faction List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: '0 0 150px',
              overflowY: 'auto',
              borderRight: `1px solid ${colors.border2}`,
              paddingRight: 10,
            }}
          >
            {factions.map((f) => {
              const isSelected = selectedFactionId === f.factionId;
              return (
                <button
                  key={f.factionId}
                  onClick={() => setSelectedFactionId(f.factionId)}
                  style={{
                    padding: '6px 8px',
                    background: isSelected ? colors.card : colors.inset,
                    color: standingColor(f.standing),
                    border: `1px solid ${isSelected ? colors.border : colors.border2}`,
                    borderRadius: '2px',
                    fontSize: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    fontFamily: FONT_STACK,
                  }}
                  title={f.name}
                >
                  {f.name}
                </button>
              );
            })}
          </div>

          {/* Faction Details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {selectedFaction ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.lime, marginBottom: 4 }}>
                    {selectedFaction.name}
                  </div>
                  <div style={{ fontSize: 10, color: colors.muted }}>
                    Disposition: {selectedFaction.alignment}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <SectionLabel label="Standing" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          width: '100%',
                          height: 8,
                          background: colors.inset,
                          border: `1px solid ${colors.border2}`,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round(
                              (selectedFaction.standing / selectedFaction.maxStanding) * 100,
                            )}%`,
                            height: '100%',
                            background: standingColor(selectedFaction.standing),
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ minWidth: 60, textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: standingColor(selectedFaction.standing),
                        }}
                      >
                        {selectedFaction.standing > 100 ? '+' : ''}
                        {selectedFaction.standing - 100}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedFaction.description && (
                  <div style={{ marginBottom: 12 }}>
                    <SectionLabel label="Description" />
                    <div style={{ fontSize: 10, color: colors.text, lineHeight: 1.4 }}>
                      {selectedFaction.description}
                    </div>
                  </div>
                )}

                {selectedFaction.enemiesInCurrentDungeon &&
                  selectedFaction.enemiesInCurrentDungeon.length > 0 && (
                    <div>
                      <SectionLabel label="Enemies in Dungeon" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {selectedFaction.enemiesInCurrentDungeon.map((enemy, idx) => (
                          <div key={idx} style={{ fontSize: 10, color: colors.blood }}>
                            • {enemy}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            ) : (
              <div style={{ color: colors.muted, fontSize: 11 }}>
                Select a faction to view details
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ ...btnStyle, marginTop: 16, padding: '6px 12px', fontSize: 11 }}
        >
          Close
        </button>
      </ModalCard>
    </ModalBackdrop>
  );
}
