import React, { useState } from 'react';
import type { PlayerHudView } from '@dungeon/presenter';
import { StatDetailModal } from './StatDetailModal.js';

interface ClickableStatGridProps {
  player: PlayerHudView;
}

function getHealthColor(health: number, maxHealth: number): string {
  const pct = Math.round((health / maxHealth) * 100);
  if (pct > 60) return '#4f4';
  if (pct > 30) return '#ff4';
  return '#f44';
}

export function ClickableStatGrid({ player }: ClickableStatGridProps) {
  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const stats = [
    { key: 'health', label: 'HP', value: `${player.health}/${player.maxHealth}`, color: getHealthColor(player.health, player.maxHealth) },
    { key: 'experience', label: 'XP', value: player.experience.toString(), color: '#6af' },
    { key: 'attack', label: 'ATK', value: player.attack.toString(), color: '#fa4' },
    { key: 'defense', label: 'DEF', value: player.defense.toString(), color: '#fa4' },
    ...(player.accuracy !== undefined ? [{ key: 'accuracy', label: 'ACC', value: `${player.accuracy}%`, color: '#4af' }] : []),
    ...(player.evasion !== undefined ? [{ key: 'evasion', label: 'EVA', value: `${player.evasion}%`, color: '#4af' }] : []),
    ...(player.speed !== undefined ? [{ key: 'speed', label: 'SPD', value: player.speed.toString(), color: '#4af' }] : []),
    { key: 'gold', label: 'Gold', value: `${player.gold}g`, color: '#cc8' },
  ];

  const selectedBreakdown = selectedStat ? player.statBreakdowns[selectedStat] : null;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        {stats.map(stat => (
          <button
            key={stat.key}
            onClick={() => setSelectedStat(selectedStat === stat.key ? null : stat.key)}
            style={{
              background: selectedStat === stat.key ? '#1a3a3a' : '#1a1a1a',
              padding: '6px',
              border: selectedStat === stat.key ? '1px solid #2a6a6a' : '1px solid #333',
              cursor: 'pointer',
              textAlign: 'left',
              color: stat.color,
              fontFamily: 'monospace',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ color: '#888', marginBottom: 2, fontSize: 10 }}>{stat.label}</div>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>{stat.value}</div>
          </button>
        ))}
      </div>

      {selectedBreakdown && (
        <StatDetailModal
          breakdown={selectedBreakdown}
          onClose={() => setSelectedStat(null)}
        />
      )}
    </>
  );
}
