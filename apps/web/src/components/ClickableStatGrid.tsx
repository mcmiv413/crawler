import React, { useState } from 'react';
import type { PlayerHudView } from '@dungeon/presenter';
import { StatDetailModal } from './StatDetailModal.js';
import { colors, FONT_STACK } from '../styles.js';

interface ClickableStatGridProps {
  player: PlayerHudView;
}

// Per-stat accent colours. See DESIGN.md § Stat Grid.
const STAT_COLORS: Record<string, string> = {
  health:   colors.lime,
  attack:   colors.gold,
  defense:  colors.steel,
  accuracy: colors.teal,
  evasion:  colors.teal,
  speed:    colors.purple,
};

export function ClickableStatGrid({ player }: ClickableStatGridProps) {
  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const stats = [
    {
      key: 'health',
      label: 'HP',
      value: `${player.health}`,
      sub: `/${player.maxHealth}`,
      detail: '',
    },
    {
      key: 'attack',
      label: 'DMG',
      value: `${player.totalDamageMin}–${player.totalDamageMax}`,
      sub: '',
      detail: '',
    },
    {
      key: 'defense',
      label: 'DEF',
      value: player.defense.toString(),
      sub: '',
      detail: `${Math.round(player.defense / (player.defense + 35) * 100)}% mit`,
    },
    { key: 'accuracy', label: 'ACC', value: `+${player.accuracy}`, sub: '', detail: `${Math.min(95, Math.max(15, 65 + player.accuracy))}% base hit` },
    { key: 'evasion', label: 'EVA', value: `+${player.evasion}`, sub: '', detail: `-${player.evasion}% enemy hit` },
    { key: 'speed', label: 'SPD', value: player.speed.toString(), sub: '', detail: '' },
  ];

  const selectedBreakdown = selectedStat ? player.statBreakdowns[selectedStat] : null;
  const accentColor = (key: string) => STAT_COLORS[key] ?? colors.text;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4,
          marginBottom: 12,
          fontFamily: FONT_STACK,
        }}
      >
        {stats.map(stat => {
          const isSelected = selectedStat === stat.key;
          return (
            <button
              key={stat.key}
              onClick={() => setSelectedStat(isSelected ? null : stat.key)}
              style={{
                background: isSelected ? '#1a3a3a' : colors.inset,
                padding: '6px 8px',
                border: `1px solid ${isSelected ? '#2a6a6a' : colors.border2}`,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: FONT_STACK,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              title={`Click to see ${stat.label} breakdown`}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: colors.muted,
                  marginBottom: 3,
                }}
              >
                {stat.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: accentColor(stat.key) }}>
                {stat.value}
                {stat.sub && (
                  <span style={{ fontSize: 10, color: colors.muted }}>
                    {stat.sub}
                  </span>
                )}
              </div>
              {stat.detail && (
                <div style={{ fontSize: 9, color: colors.muted, marginTop: 2 }}>
                  {stat.detail}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedBreakdown && (
        <StatDetailModal
          breakdown={selectedBreakdown}
          onClose={() => setSelectedStat(null)}
          player={player}
        />
      )}
    </>
  );
}
