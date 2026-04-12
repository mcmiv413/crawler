import React from 'react';
import type { GameView, NemesisView } from '@dungeon/presenter';
import { btnStyle } from '../styles.js';

interface NemesisRisenScreenProps {
  view: GameView;
  nemesis: NemesisView;
  onDismiss: () => void;
}

export function NemesisRisenScreen({ view, nemesis, onDismiss }: NemesisRisenScreenProps) {
  return (
    <div
      style={{
        padding: 20,
        fontFamily: 'monospace',
        color: '#ccc',
        background: '#111',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <h2 style={{ color: '#f88', fontSize: 32, marginBottom: 10 }}>A New Nemesis Rises</h2>

      <div style={{ color: '#cc8844', fontSize: 14, marginBottom: 20, maxWidth: 500 }}>
        Your death echoes through the dungeon depths. From the darkness, a new threat emerges—born from your defeat, hungering for power.
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: 16,
          border: '2px solid #4a2a1a',
          background: '#1a0a0a',
          borderRadius: 4,
          maxWidth: 500,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 8, color: '#ff6666', fontSize: 18 }}>The New Threat</h3>

        <div style={{ textAlign: 'left', fontSize: 12, color: '#aaa', lineHeight: 1.8 }}>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: '#ff8888' }}>
              {nemesis.name} {nemesis.title}
            </strong>
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#888' }}>Tier:</span> {nemesis.tier}
            {' | '}
            <span style={{ color: '#888' }}>Rank:</span> {nemesis.rank === 1 ? 'Initiate' : nemesis.rank === 2 ? 'Veteran' : 'Legendary'}
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#888' }}>First Ascension:</span> Floor {nemesis.floorOfAscension}
          </div>

          {nemesis.weaknesses && nemesis.weaknesses.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
              <span style={{ color: '#888' }}>Vulnerabilities:</span> {nemesis.weaknesses.join(', ')}
            </div>
          )}
        </div>
      </div>

      <div style={{ color: '#aaa', fontSize: 11, marginBottom: 20, maxWidth: 500, fontStyle: 'italic' }}>
        This nemesis will grow stronger with each passing run, a permanent shadow over the dungeon. Prepare yourself for the reckoning ahead.
      </div>

      <button onClick={onDismiss} style={{ ...btnStyle, background: '#442200', color: '#cc8844', minWidth: 200 }}>
        Return to Town
      </button>
    </div>
  );
}
