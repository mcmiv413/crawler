import React from 'react';
import type { RunSummaryStats } from '@dungeon/presenter';

interface RunSummaryPanelProps {
  stats: RunSummaryStats;
}

export function RunSummaryPanel({ stats }: RunSummaryPanelProps) {
  return (
    <div style={{ marginBottom: 10, padding: 8, border: '1px solid #553300', background: '#1a1100' }}>
      <h4 style={{ margin: 0, color: '#cc8844' }}>Last Run Summary</h4>
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
        <div>Floors cleared: {stats.floorsCleared} | Enemies slain: {stats.enemiesKilled} | Gold earned: <span style={{ color: '#cc8' }}>{stats.goldEarned}</span></div>
        <div style={{ marginTop: 2 }}>
          {stats.prosperityDelta !== 0 && <span style={{ color: stats.prosperityDelta > 0 ? '#4f4' : '#f44', marginRight: 8 }}>Prosperity {stats.prosperityDelta > 0 ? '+' : ''}{stats.prosperityDelta}</span>}
          {stats.fearDelta !== 0 && <span style={{ color: stats.fearDelta > 0 ? '#f44' : '#4f4', marginRight: 8 }}>Fear {stats.fearDelta > 0 ? '+' : ''}{stats.fearDelta}</span>}
          {stats.corruptionDelta !== 0 && <span style={{ color: stats.corruptionDelta > 0 ? '#f44' : '#4f4', marginRight: 8 }}>Corruption {stats.corruptionDelta > 0 ? '+' : ''}{stats.corruptionDelta}</span>}
        </div>
      </div>
    </div>
  );
}
