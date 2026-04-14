import React from 'react';
import type { StatBreakdown } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon';

const statDescriptions: Record<string, string> = {
  health: 'Maximum health. Determines how much damage you can take before dying.',
  attack: 'Damage dealt to enemies in combat. Higher attack means more damage per hit.',
  defense: 'Damage reduction. Each point of defense reduces incoming damage by a percentage.',
  accuracy: 'Chance to hit enemies in combat. Affects whether your attacks connect.',
  evasion: 'Chance to dodge incoming attacks. Higher evasion means you take less damage.',
  speed: 'Turn order in combat. Higher speed means you act sooner in each round.',
};

interface StatDetailModalProps {
  breakdown: StatBreakdown;
  onClose: () => void;
}

export function StatDetailModal({ breakdown, onClose }: StatDetailModalProps) {
  return (
    <div style={{ marginBottom: 12, padding: 8, background: '#1a2a3a', border: '1px solid #2a4a6a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#6af', textTransform: 'uppercase' }}>
          {breakdown.stat}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '2px 6px',
            background: '#333',
            color: '#aaa',
            border: '1px solid #555',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, fontSize: 11 }}>
        <div>
          <div style={{ color: '#888', marginBottom: 2 }}>Base Value</div>
          <div style={{ color: '#4f4', fontSize: 12, fontWeight: 'bold' }}>{breakdown.base}</div>
        </div>
        <div>
          <div style={{ color: '#888', marginBottom: 2 }}>Total Value</div>
          <div style={{ color: '#fa4', fontSize: 12, fontWeight: 'bold' }}>{breakdown.total}</div>
        </div>
      </div>

      {breakdown.bonuses.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>BONUSES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {breakdown.bonuses.map((bonus, idx) => (
              <div key={idx} style={{ fontSize: 10, color: '#8f8', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
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

      <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4, borderTop: '1px solid #333', paddingTop: 6 }}>
        {statDescriptions[breakdown.stat] || 'No description available.'}
      </div>
    </div>
  );
}
