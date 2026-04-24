import React from 'react';
import type { GameView } from '@dungeon/presenter';
import { btnStashStyle, colors } from '../styles.js';
import { ScreenOverlay, InfoCard, SectionLabel } from './ui/index.js';

interface NemesisFelledScreenProps {
  view: GameView;
  onDismiss: () => void;
}

function rankLabel(rank: number): string {
  return rank === 1 ? 'Initiate' : rank === 2 ? 'Veteran' : 'Legendary';
}

export function NemesisFelledScreen({ view, onDismiss }: NemesisFelledScreenProps) {
  const nemesis = view.town?.nemeses.filter((n) => n.isActive).pop();
  if (!nemesis) return null;

  return (
    <ScreenOverlay>
      <div style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
        <h2 style={{ color: colors.blood, fontSize: 28, marginBottom: 10 }}>
          You Have Been Felled
        </h2>

        <div style={{ color: colors.gold, fontSize: 13, marginBottom: 20 }}>
          Your fall has not been forgotten. From your ashes rises a new nemesis, born of the very
          dungeon itself.
        </div>

        <InfoCard borderColor={colors.blood} marginBottom={20} style={{ padding: 14 }}>
          <SectionLabel label="A New Nemesis Rises" color={colors.blood} />
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
              <span style={{ color: colors.muted }}>First seen:</span> Floor{' '}
              {nemesis.floorOfAscension}
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: colors.muted }}>Kills:</span> {nemesis.killCount}
            </div>
            {nemesis.weaknesses && nemesis.weaknesses.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${colors.border2}` }}>
                <span style={{ color: colors.muted }}>Weaknesses:</span>{' '}
                {nemesis.weaknesses.join(', ')}
              </div>
            )}
          </div>
        </InfoCard>

        <div
          style={{
            color: colors.muted,
            fontSize: 11,
            marginBottom: 20,
            fontStyle: 'italic',
          }}
        >
          This nemesis will haunt the dungeon, growing stronger with each passing run. Only by
          slaying this foe can you find peace.
        </div>

        <button onClick={onDismiss} style={{ ...btnStashStyle, minWidth: 200 }}>
          Return to Town
        </button>
      </div>
    </ScreenOverlay>
  );
}
