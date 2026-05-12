import React from 'react';
import type { StatBreakdown, PlayerHudView } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon';
import { colors, FONT_STACK } from '../styles.js';
import { SectionLabel } from './ui/index.js';

// Per-stat accent from DESIGN.md § Stat colour map.
const statColors: Record<string, string> = {
  health: colors.lime,
  attack: '#e07030',
  defense: colors.steel,
  accuracy: colors.gold,
  evasion: colors.teal,
  speed: colors.purple,
};

interface StatDetailModalProps {
  breakdown: StatBreakdown;
  onClose: () => void;
  player?: PlayerHudView;
}

export function StatDetailModal({ breakdown, onClose, player }: StatDetailModalProps) {
  const accent = statColors[breakdown.stat] ?? colors.text;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        background: colors.inset,
        border: `1px solid ${colors.border}`,
        borderRadius: '2px',
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: accent,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {breakdown.stat}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            padding: '2px 6px',
            background: 'transparent',
            color: colors.muted,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: FONT_STACK,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10, fontSize: 11 }}>
        <div>
          <div style={{ color: colors.muted, marginBottom: 2, fontSize: 10 }}>Base Value</div>
          <div style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>{breakdown.base}</div>
        </div>
        <div>
          <div style={{ color: colors.muted, marginBottom: 2, fontSize: 10 }}>Total Value</div>
          <div style={{ color: accent, fontSize: 13, fontWeight: 600 }}>{breakdown.total}</div>
        </div>
      </div>

      {breakdown.bonuses.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <SectionLabel label="Bonuses" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {breakdown.bonuses.map((bonus, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: 10,
                  color: colors.lime,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {bonus.spriteName && <ItemSpriteIcon spriteName={bonus.spriteName} size={16} />}
                  <span>{bonus.source}</span>
                </div>
                <span>+{bonus.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {breakdown.stat === 'attack' && player && (
        <div style={{ marginBottom: 8, padding: 6, background: colors.border2, borderRadius: '2px' }}>
          <div style={{ fontSize: 10, color: colors.muted, marginBottom: 4 }}>Total Damage Range</div>
          <div style={{ fontSize: 12, color: colors.text, fontWeight: 600 }}>
            {player.totalDamageMin}–{player.totalDamageMax} damage
          </div>
          <div style={{ fontSize: 9, color: colors.muted, marginTop: 2 }}>
            Attack bonus {breakdown.total} + weapon damage range
          </div>
        </div>
      )}

      {breakdown.effect && (
        <div style={{ marginBottom: 8, padding: 6, background: colors.border2, borderRadius: '2px' }}>
          <div style={{ fontSize: 10, color: colors.muted, marginBottom: 4 }}>{breakdown.effect.label}</div>
          <div style={{ fontSize: 12, color: colors.text, fontWeight: 600 }}>
            {breakdown.effect.value}
          </div>
          <div style={{ fontSize: 9, color: colors.muted, marginTop: 2 }}>
            {breakdown.effect.description}
          </div>
        </div>
      )}

      <div
        style={{
          fontSize: 10,
          color: colors.label,
          lineHeight: 1.4,
          borderTop: `1px solid ${colors.border2}`,
          paddingTop: 6,
        }}
      >
        {breakdown.description ?? 'No description available.'}
      </div>
    </div>
  );
}
