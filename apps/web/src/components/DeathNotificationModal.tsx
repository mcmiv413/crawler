import React from 'react';
import type { DeathContext } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { btnStashStyle, colors } from '../styles.js';
import { ScreenOverlay, InfoCard } from './ui/index.js';

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
    <ScreenOverlay>
      <div style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
        <h2 style={{ color: colors.blood, fontSize: 28, marginBottom: 20 }}>You Were Slain</h2>

        <InfoCard
          borderColor={colors.blood}
          marginBottom={20}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}
        >
          {deathContext.killerSpriteName && (
            <div style={{ flexShrink: 0 }}>
              <ItemSpriteIcon spriteName={deathContext.killerSpriteName} size={32} />
            </div>
          )}
          <div style={{ textAlign: 'left', fontSize: 13, color: colors.text }}>
            {deathContext.killerName ? (
              <>
                Felled by{' '}
                <strong style={{ color: colors.blood }}>{deathContext.killerName}</strong> on floor{' '}
                {deathContext.floor}
              </>
            ) : (
              <>Slain on floor {deathContext.floor}</>
            )}
          </div>
        </InfoCard>

        <InfoCard
          marginBottom={20}
          style={{ textAlign: 'left', fontSize: 12, color: colors.text, lineHeight: 1.8, padding: 12 }}
        >
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: colors.muted }}>Equipment dropped:</span>{' '}
            {deathContext.equipmentLost.length > 0 ? (
              <strong style={{ color: colors.blood }}>
                {deathContext.equipmentLost.map((e) => e.itemName).join(', ')}
              </strong>
            ) : (
              <span style={{ color: colors.muted }}>none</span>
            )}
          </div>

          <div>
            <span style={{ color: colors.muted }}>Gold lost:</span>{' '}
            <strong style={{ color: colors.gold }}>{deathContext.goldLost} gold</strong>
          </div>
        </InfoCard>

        <div
          style={{
            marginBottom: 20,
            padding: 10,
            fontSize: 11,
            color: colors.muted,
            fontStyle: 'italic',
          }}
        >
          The town guard rushed in and carried you back to town.
        </div>

        <InfoCard
          marginBottom={20}
          style={{ textAlign: 'left', fontSize: 11, color: colors.text, padding: 10 }}
        >
          <div style={{ marginBottom: 6 }}>
            {getPermadeathProximityMessage(
              deathContext.overkillDamage,
              deathContext.permadeathThreshold,
            )}
          </div>
          <div style={{ color: colors.muted, fontSize: 10 }}>
            {deathContext.totalDeaths} deaths survived
          </div>
        </InfoCard>

        <button onClick={onDismiss} style={{ ...btnStashStyle, minWidth: 200 }}>
          Return to Town
        </button>
      </div>
    </ScreenOverlay>
  );
}
