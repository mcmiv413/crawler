import React from 'react';
import type { GameView, NemesisView, DeathContext } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { btnStashStyle, colors } from '../styles.js';
import { ScreenOverlay, InfoCard, SectionLabel } from './ui/index.js';

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

function rankLabel(rank: number): string {
  return rank === 1 ? 'Initiate' : rank === 2 ? 'Veteran' : 'Legendary';
}

export function NemesisRisenScreen({ nemesis, deathContext, onDismiss }: NemesisRisenScreenProps) {
  return (
    <ScreenOverlay>
      <div style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
        <h2 style={{ color: colors.blood, fontSize: 28, marginBottom: 10 }}>A New Nemesis Rises</h2>

        <div style={{ color: colors.gold, fontSize: 13, marginBottom: 20 }}>
          Your death echoes through the dungeon depths. From the darkness, a new threat emerges —
          born from your defeat, hungering for power.
        </div>

        <InfoCard borderColor={colors.blood} marginBottom={20} style={{ padding: 14 }}>
          <SectionLabel label="The New Threat" color={colors.blood} />
          <div style={{ textAlign: 'left', fontSize: 12, color: colors.text, lineHeight: 1.8 }}>
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: colors.blood }}>
                {nemesis.name} {nemesis.title}
              </strong>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: colors.muted }}>Tier:</span> {nemesis.tier}
              {' | '}
              <span style={{ color: colors.muted }}>Rank:</span> {rankLabel(nemesis.rank)}
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: colors.muted }}>First Ascension:</span> Floor{' '}
              {nemesis.floorOfAscension}
            </div>
            {nemesis.weaknesses && nemesis.weaknesses.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${colors.border2}` }}>
                <span style={{ color: colors.muted }}>Vulnerabilities:</span>{' '}
                {nemesis.weaknesses.join(', ')}
              </div>
            )}
          </div>
        </InfoCard>

        {deathContext && (
          <InfoCard
            marginBottom={20}
            style={{ padding: 12, textAlign: 'left', fontSize: 11, color: colors.text }}
          >
            <SectionLabel label="What Happened" />
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              {deathContext.killerSpriteName && (
                <ItemSpriteIcon spriteName={deathContext.killerSpriteName} size={24} />
              )}
              <div>
                {deathContext.killerName ? (
                  <>
                    Felled by{' '}
                    <strong style={{ color: colors.blood }}>{deathContext.killerName}</strong>
                  </>
                ) : (
                  <>Slain by the dungeon</>
                )}{' '}
                on floor {deathContext.floor}
              </div>
            </div>

            {deathContext.equipmentLost.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                You dropped:{' '}
                <strong style={{ color: colors.blood }}>
                  {deathContext.equipmentLost.map((e) => e.itemName).join(', ')}
                </strong>
              </div>
            )}

            <div style={{ marginBottom: 8 }}>
              You lost <strong style={{ color: colors.gold }}>{deathContext.goldLost} gold</strong>
            </div>

            <div style={{ color: colors.muted, fontSize: 10, fontStyle: 'italic' }}>
              The town guard dragged you back to safety.
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: `1px solid ${colors.border2}`,
                fontSize: 10,
              }}
            >
              <div style={{ marginBottom: 6, color: colors.text }}>
                {getPermadeathProximityMessage(
                  deathContext.overkillDamage,
                  deathContext.permadeathThreshold,
                )}
              </div>
              <div style={{ color: colors.muted }}>
                {deathContext.totalDeaths} deaths survived
              </div>
            </div>
          </InfoCard>
        )}

        <div
          style={{
            color: colors.muted,
            fontSize: 11,
            marginBottom: 20,
            fontStyle: 'italic',
          }}
        >
          This nemesis will grow stronger with each passing run, a permanent shadow over the
          dungeon. Prepare yourself for the reckoning ahead.
        </div>

        <button onClick={onDismiss} style={{ ...btnStashStyle, minWidth: 200 }}>
          Return to Town
        </button>
      </div>
    </ScreenOverlay>
  );
}
