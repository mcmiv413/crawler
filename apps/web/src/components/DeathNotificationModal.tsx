import React from 'react';
import type { DeathContext } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { btnStyle } from '../styles.js';

interface DeathNotificationModalProps {
  deathContext: DeathContext;
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

export function DeathNotificationModal({ deathContext, onDismiss }: DeathNotificationModalProps) {
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
      {/* Header */}
      <h2 style={{ color: '#f88', fontSize: 32, marginBottom: 20 }}>You Were Slain</h2>

      {/* Killer Row */}
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          border: '1px solid #333',
          background: '#0a0a0a',
          borderRadius: 4,
          maxWidth: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {deathContext.killerSpriteName && (
          <div style={{ flexShrink: 0 }}>
            <ItemSpriteIcon spriteName={deathContext.killerSpriteName} size={32} />
          </div>
        )}
        <div style={{ textAlign: 'left', fontSize: 13, color: '#aaa' }}>
          {deathContext.killerName ? (
            <>
              Felled by <strong style={{ color: '#ff9999' }}>{deathContext.killerName}</strong>
              {' '}on floor {deathContext.floor}
            </>
          ) : (
            <>
              Slain on floor {deathContext.floor}
            </>
          )}
        </div>
      </div>

      {/* Consequences */}
      <div
        style={{
          marginBottom: 24,
          padding: 14,
          border: '1px solid #333',
          background: '#0a0a0a',
          borderRadius: 4,
          maxWidth: 500,
          textAlign: 'left',
          fontSize: 12,
          color: '#aaa',
          lineHeight: 1.8,
        }}
      >
        {/* Equipment Lost */}
        <div style={{ marginBottom: 10 }}>
          <span style={{ color: '#888' }}>Equipment dropped:</span>{' '}
          {deathContext.equipmentLost.length > 0 ? (
            <strong style={{ color: '#cc9999' }}>
              {deathContext.equipmentLost.map(e => e.itemName).join(', ')}
            </strong>
          ) : (
            <span style={{ color: '#666' }}>none</span>
          )}
        </div>

        {/* Gold Lost */}
        <div>
          <span style={{ color: '#888' }}>Gold lost:</span>{' '}
          <strong style={{ color: '#ffcc66' }}>{deathContext.goldLost} gold</strong>
        </div>
      </div>

      {/* Rescue */}
      <div
        style={{
          marginBottom: 24,
          padding: 12,
          fontSize: 11,
          color: '#888',
          fontStyle: 'italic',
          maxWidth: 500,
        }}
      >
        The town guard rushed in and carried you back to town.
      </div>

      {/* Permadeath Proximity */}
      <div
        style={{
          marginBottom: 24,
          padding: 12,
          border: '1px solid #333',
          background: '#0a0a0a',
          borderRadius: 4,
          maxWidth: 500,
          fontSize: 11,
          color: '#aaa',
          textAlign: 'left',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          {getPermadeathProximityMessage(deathContext.overkillDamage, deathContext.permadeathThreshold)}
        </div>
        <div style={{ color: '#666', fontSize: 10 }}>
          {deathContext.totalDeaths} deaths survived
        </div>
      </div>

      {/* Dismiss Button */}
      <button onClick={onDismiss} style={{ ...btnStyle, background: '#442200', color: '#cc8844', minWidth: 200 }}>
        Return to Town
      </button>
    </div>
  );
}
