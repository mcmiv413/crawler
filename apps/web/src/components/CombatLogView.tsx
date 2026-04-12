import React, { useRef, useEffect } from 'react';
import { COMBAT_LOG_MAX_HEIGHT } from '../config/ui-config.js';
import { useGameStore } from '../store/game-store.js';

interface CombatLogViewProps {
  entries: readonly { text: string; type: string }[];
  debugMode: boolean;
}

export function CombatLogView({ entries, debugMode }: CombatLogViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toggleDebugLogging } = useGameStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const filteredEntries = entries.filter(entry => {
    if (!debugMode && entry.text.startsWith('[DEBUG]')) {
      return false;
    }
    return true;
  });

  if (filteredEntries.length === 0) return null;

  function logColor(entry: { text: string; type: string }): string {
    if (entry.type === 'death') return '#f44';
    if (entry.type === 'loot') return '#4f4';
    if (entry.type === 'info') return '#8cf';
    return '#aaa';
  }

  return (
    <div ref={scrollRef} style={{ marginTop: 10, maxHeight: COMBAT_LOG_MAX_HEIGHT, overflowY: 'auto', border: '1px solid #333', padding: 5, background: '#0a0a0a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <h4 style={{ margin: 0, color: '#888' }}>Log</h4>
        <button
          onClick={toggleDebugLogging}
          style={{
            padding: '2px 8px',
            fontSize: 10,
            background: debugMode ? '#f44' : '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
          }}
          title="Toggle game debug mode to see ambient behavior transitions"
        >
          {debugMode ? '🐛 DEBUG ON' : 'DEBUG'}
        </button>
      </div>
      {filteredEntries.map((entry, i) => (
        <div key={i} style={{ fontSize: 11, color: logColor(entry), padding: '1px 0' }}>
          {entry.text}
        </div>
      ))}
    </div>
  );
}
