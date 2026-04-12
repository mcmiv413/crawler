import React from 'react';
import type { GameView, NemesisView } from '@dungeon/presenter';
import { btnStyle } from '../styles.js';

interface NemesisFelledScreenProps {
  view: GameView;
  onDismiss: () => void;
}

export function NemesisFelledScreen({ view, onDismiss }: NemesisFelledScreenProps) {
  // Find the most recently promoted nemesis (last in array with isActive: true)
  const nemesis = view.town?.nemeses.filter(n => n.isActive).pop();

  if (!nemesis) {
    // Should not happen, but fall back to dismiss
    return null;
  }

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
      <h2 style={{ color: '#f44', fontSize: 32, marginBottom: 10 }}>You Have Been Felled</h2>

      <div style={{ color: '#cc8844', fontSize: 14, marginBottom: 20, maxWidth: 500 }}>
        Your fall has not been forgotten. From your ashes rises a new nemesis, born of the very dungeon itself.
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: 16,
          border: '2px solid #4a1a1a',
          background: '#1a0a0a',
          borderRadius: 4,
          maxWidth: 500,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 8, color: '#cc4444', fontSize: 18 }}>A New Nemesis Rises</h3>

        <div style={{ textAlign: 'left', fontSize: 12, color: '#aaa', lineHeight: 1.8 }}>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: '#cc6666' }}>
              {nemesis.name} {nemesis.title}
            </strong>
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#888' }}>Tier:</span> {nemesis.tier}
            {' | '}
            <span style={{ color: '#888' }}>Rank:</span> {nemesis.rank === 1 ? 'Initiate' : nemesis.rank === 2 ? 'Veteran' : 'Legendary'}
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#888' }}>First seen:</span> Floor {nemesis.floorOfAscension}
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#888' }}>Kills:</span> {nemesis.killCount}
          </div>

          {nemesis.weaknesses && nemesis.weaknesses.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
              <span style={{ color: '#888' }}>Weaknesses:</span> {nemesis.weaknesses.join(', ')}
            </div>
          )}
        </div>
      </div>

      <div style={{ color: '#aaa', fontSize: 11, marginBottom: 20, maxWidth: 500, fontStyle: 'italic' }}>
        This nemesis will haunt the dungeon, growing stronger with each passing run. Only by slaying this foe can you find peace.
      </div>

      <button onClick={onDismiss} style={{ ...btnStyle, background: '#442200', color: '#cc8844', minWidth: 200 }}>
        Return to Town
      </button>
    </div>
  );
}
