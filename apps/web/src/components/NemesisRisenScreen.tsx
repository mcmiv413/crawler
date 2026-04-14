import React from 'react';
import type { GameView, NemesisView, DeathContext } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { btnStyle } from '../styles.js';

interface NemesisRisenScreenProps {
  view: GameView;
  nemesis: NemesisView;
  deathContext: DeathContext | null;
  onDismiss: () => void;
}

function getPermadeathProximityMessage(overkillDamage: number, threshold: number): string {
  if (overkillDamage === 0) {
    return 'The blow that killed you was clean — no risk of permanent death.';
  }
  const percentOfThreshold = (overkillDamage / threshold) * 100;
  if (percentOfThreshold < 50) {
    return 'A stronger blow could have ended you for good.';
  }
  return 'That was dangerously close to permanent death.';
}

export function NemesisRisenScreen({ view, nemesis, deathContext, onDismiss }: NemesisRisenScreenProps) {
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

      {/* Nemesis Hero Section */}
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

      {/* Death Context Section (if available) */}
      {deathContext && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            border: '1px solid #444',
            background: '#0a0a0a',
            borderRadius: 4,
            maxWidth: 500,
            fontSize: 11,
            color: '#aaa',
            textAlign: 'left',
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: '#888' }}>What Happened:</span>
          </div>

          {/* Killer Info */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            {deathContext.killerSpriteName && <ItemSpriteIcon spriteName={deathContext.killerSpriteName} size={24} />}
            <div>
              {deathContext.killerName ? (
                <>
                  Felled by <strong style={{ color: '#ff9999' }}>{deathContext.killerName}</strong>
                </>
              ) : (
                <>Slain by the dungeon</>
              )}{' '}
              on floor {deathContext.floor}
            </div>
          </div>

          {/* Equipment Lost */}
          {deathContext.equipmentLost.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              You dropped: <strong style={{ color: '#cc9999' }}>{deathContext.equipmentLost.map(e => e.itemName).join(', ')}</strong>
            </div>
          )}

          {/* Gold Lost */}
          <div style={{ marginBottom: 8 }}>
            You lost <strong style={{ color: '#ffcc66' }}>{deathContext.goldLost} gold</strong>
          </div>

          {/* Rescue */}
          <div style={{ color: '#888', fontSize: 10, fontStyle: 'italic' }}>
            The town guard dragged you back to safety.
          </div>

          {/* Permadeath Proximity */}
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #333',
              fontSize: 10,
            }}
          >
            <div style={{ marginBottom: 6, color: '#888' }}>
              {getPermadeathProximityMessage(deathContext.overkillDamage, deathContext.permadeathThreshold)}
            </div>
            <div style={{ color: '#666' }}>
              {deathContext.totalDeaths} deaths survived
            </div>
          </div>
        </div>
      )}

      <div style={{ color: '#aaa', fontSize: 11, marginBottom: 20, maxWidth: 500, fontStyle: 'italic' }}>
        This nemesis will grow stronger with each passing run, a permanent shadow over the dungeon. Prepare yourself for the reckoning ahead.
      </div>

      <button onClick={onDismiss} style={{ ...btnStyle, background: '#442200', color: '#cc8844', minWidth: 200 }}>
        Return to Town
      </button>
    </div>
  );
}
