import React from 'react';
import type { GameView, NemesisView } from '@dungeon/presenter';
import { btnStyle } from '../styles.js';

interface NemesisSlainScreenProps {
  view: GameView;
  nemesis: NemesisView;
  onDismiss: () => void;
}

export function NemesisSlainScreen({ view, nemesis, onDismiss }: NemesisSlainScreenProps) {
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
      <h2 style={{ color: '#4f4', fontSize: 32, marginBottom: 10 }}>Nemesis Defeated!</h2>

      <div style={{ color: '#88cc44', fontSize: 14, marginBottom: 20, maxWidth: 500 }}>
        You have slain a nemesis and brought peace to the dungeon.
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: 16,
          border: '2px solid #1a4a1a',
          background: '#0a1a0a',
          borderRadius: 4,
          maxWidth: 500,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 8, color: '#44cc44', fontSize: 18 }}>Vanquished</h3>

        <div style={{ textAlign: 'left', fontSize: 12, color: '#aaa', lineHeight: 1.8 }}>
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: '#66cc66' }}>
              {nemesis.name} {nemesis.title}
            </strong>
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#888' }}>Tier:</span> {nemesis.tier}
            {' | '}
            <span style={{ color: '#888' }}>Rank:</span> {nemesis.rank === 1 ? 'Initiate' : nemesis.rank === 2 ? 'Veteran' : 'Legendary'}
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#888' }}>Kills:</span> {nemesis.killCount}
          </div>

          {nemesis.killedByWeaponType && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#888' }}>Slain by:</span> {nemesis.killedByWeaponType}
            </div>
          )}

          {nemesis.weaknesses && nemesis.weaknesses.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
              <span style={{ color: '#888' }}>Weaknesses:</span> {nemesis.weaknesses.join(', ')}
            </div>
          )}
        </div>
      </div>

      <div style={{ color: '#aaa', fontSize: 11, marginBottom: 20, maxWidth: 500, fontStyle: 'italic' }}>
        The dungeon's corruption lessens, but new threats stir in the depths.
      </div>

      <button onClick={onDismiss} style={{ ...btnStyle, background: '#224422', color: '#88cc44', minWidth: 200 }}>
        Continue
      </button>
    </div>
  );
}
