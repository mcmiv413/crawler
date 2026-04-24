import React from 'react';
import type { StatBreakdown } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon';
import { colors, FONT_STACK } from '../styles.js';
import { SectionLabel } from './ui/index.js';

const statDescriptions: Record<string, string> = {
  health: 'Maximum health. Determines how much damage you can take before dying.',
  attack: 'Damage dealt to enemies in combat. Higher attack means more damage per hit.',
  defense: 'Damage reduction. Each point of defense reduces incoming damage by a percentage.',
  accuracy: 'Chance to hit enemies in combat. Affects whether your attacks connect.',
  evasion: 'Chance to dodge incoming attacks. Higher evasion means you take less damage.',
  speed: 'Turn order in combat. Higher speed means you act sooner in each round.',
};

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
}

export function StatDetailModal({ breakdown, onClose }: StatDetailModalProps) {
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

      <div
        style={{
          fontSize: 10,
          color: colors.label,
          lineHeight: 1.4,
          borderTop: `1px solid ${colors.border2}`,
          paddingTop: 6,
        }}
      >
        {statDescriptions[breakdown.stat] ?? 'No description available.'}
      </div>
    </div>
  );
}
