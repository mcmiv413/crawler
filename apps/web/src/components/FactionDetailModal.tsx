import React, { useState } from 'react';
import type { FactionView } from '@dungeon/presenter';
import { colors, FONT_STACK, btnStyle } from '../styles.js';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { ModalBackdrop, ModalCard, SectionLabel } from './ui/index.js';

interface FactionDetailModalProps {
  factions: readonly FactionView[];
  onClose: () => void;
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
}

function powerBandColor(powerBand: FactionView['powerBand']): string {
  switch (powerBand) {
    case 'broken':
      return colors.lime;
    case 'weak':
      return colors.steel;
    case 'strong':
      return colors.gold;
    case 'dominant':
      return colors.blood;
    default:
      return colors.text;
  }
}

function leaderSummary(faction: FactionView): string {
  if (faction.leader.state === 'leaderless') {
    return 'No active leader';
  }

  if (faction.leader.name === null || faction.leader.title === null) {
    return faction.leader.state === 'slain' ? 'Leader slain' : 'Leader active';
  }

  const prefix = faction.leader.state === 'slain' ? 'Slain' : 'Active';
  return `${prefix}: ${faction.leader.name}, ${faction.leader.title}`;
}

export function FactionDetailModal({ factions, onClose }: FactionDetailModalProps) {
  const [selectedFactionId, setSelectedFactionId] = useState<string>(factions[0]?.id ?? '');
  const selectedFaction = selectedFactionId ? factions.find(faction => faction.id === selectedFactionId) ?? null : null;

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="FACTION PROGRESS" onClose={onClose} accentColor={colors.lime} maxWidth={720}>
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: '0 0 180px',
              overflowY: 'auto',
              borderRight: `1px solid ${colors.border2}`,
              paddingRight: 10,
            }}
          >
            {factions.map((faction) => {
              const isSelected = selectedFactionId === faction.id;
              return (
                <button
                  key={faction.id}
                  onClick={() => setSelectedFactionId(faction.id)}
                  style={{
                    padding: '8px',
                    background: isSelected ? colors.card : colors.inset,
                    color: powerBandColor(faction.powerBand),
                    border: `1px solid ${isSelected ? colors.border : colors.border2}`,
                    borderRadius: '2px',
                    fontSize: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: FONT_STACK,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{faction.name}</div>
                  <div style={{ color: colors.muted }}>{titleCase(faction.powerBand)} · {titleCase(faction.status)}</div>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {selectedFaction ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: powerBandColor(selectedFaction.powerBand), marginBottom: 4 }}>
                    {selectedFaction.name}
                  </div>
                  <div style={{ fontSize: 10, color: colors.muted }}>
                    Power {selectedFaction.power}/100 · {titleCase(selectedFaction.powerBand)} · {titleCase(selectedFaction.status)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: colors.inset, border: `1px solid ${colors.border2}`, padding: 8 }}>
                    <SectionLabel label="Members Slain" />
                    <div style={{ color: colors.lime, fontSize: 14 }}>{selectedFaction.membersKilledByPlayer}</div>
                  </div>
                  <div style={{ background: colors.inset, border: `1px solid ${colors.border2}`, padding: 8 }}>
                    <SectionLabel label="Leaders Slain" />
                    <div style={{ color: colors.gold, fontSize: 14 }}>{selectedFaction.leadersKilledByPlayer}</div>
                  </div>
                  <div style={{ background: colors.inset, border: `1px solid ${colors.border2}`, padding: 8 }}>
                    <SectionLabel label="Deaths Claimed" />
                    <div style={{ color: colors.blood, fontSize: 14 }}>{selectedFaction.playerDeathsCaused}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <SectionLabel label="Leader" />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: colors.inset, border: `1px solid ${colors.border2}`, padding: 8 }}>
                    {selectedFaction.leader.spriteName ? <ItemSpriteIcon spriteName={selectedFaction.leader.spriteName} size={32} /> : null}
                    <div>
                      <div style={{ fontSize: 11, color: colors.text }}>{leaderSummary(selectedFaction)}</div>
                      {selectedFaction.leader.emergedOnDepth !== undefined ? (
                        <div style={{ fontSize: 10, color: colors.muted }}>
                          Emerged on run {selectedFaction.leader.emergedOnRun} · floor {selectedFaction.leader.emergedOnDepth}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <SectionLabel label="Dungeon Pressure" />
                  <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.5 }}>{selectedFaction.worldEffectText}</div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <SectionLabel label="Town Effect" />
                  <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.5 }}>{selectedFaction.townEffectText}</div>
                </div>

                {selectedFaction.description ? (
                  <div style={{ marginBottom: 12 }}>
                    <SectionLabel label="Faction" />
                    <div style={{ fontSize: 10, color: colors.text, lineHeight: 1.5 }}>{selectedFaction.description}</div>
                    {selectedFaction.lore ? <div style={{ fontSize: 10, color: colors.muted, lineHeight: 1.5, marginTop: 6 }}>{selectedFaction.lore}</div> : null}
                  </div>
                ) : null}

                {selectedFaction.currentDungeonEnemies.length > 0 ? (
                  <div>
                    <SectionLabel label="Seen In Current Run" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {selectedFaction.currentDungeonEnemies.map((enemy, index) => (
                        <div key={`${enemy}-${index}`} style={{ fontSize: 10, color: colors.blood }}>
                          • {enemy}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ color: colors.muted, fontSize: 11 }}>
                Select a faction to view details.
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
