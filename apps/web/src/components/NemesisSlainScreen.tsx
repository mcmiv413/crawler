import React from 'react';
import type { GameView, NemesisView } from '@dungeon/presenter';
import { btnPrimaryStyle, colors } from '../styles.js';
import { ScreenOverlay, InfoCard, SectionLabel } from './ui/index.js';

interface NemesisSlainScreenProps {
  view: GameView;
  nemesis: NemesisView;
  onDismiss: () => void;
}

function rankLabel(rank: number): string {
  return rank === 1 ? 'Initiate' : rank === 2 ? 'Veteran' : 'Legendary';
}

export function NemesisSlainScreen({ nemesis, onDismiss }: NemesisSlainScreenProps) {
  return (
    <ScreenOverlay>
      <div style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
        <h2 style={{ color: colors.lime, fontSize: 28, marginBottom: 10 }}>Nemesis Defeated!</h2>

        <div style={{ color: colors.lime, fontSize: 13, marginBottom: 20 }}>
          You have slain a nemesis and brought peace to the dungeon.
        </div>

        <InfoCard borderColor={colors.lime} marginBottom={20} style={{ padding: 14 }}>
          <SectionLabel label="Vanquished" color={colors.lime} />
          <div style={{ textAlign: 'left', fontSize: 12, color: colors.text, lineHeight: 1.8 }}>
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: colors.lime }}>
                {nemesis.name} {nemesis.title}
              </strong>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: colors.muted }}>Tier:</span> {nemesis.tier}
              {' | '}
              <span style={{ color: colors.muted }}>Rank:</span> {rankLabel(nemesis.rank)}
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: colors.muted }}>Kills:</span> {nemesis.killCount}
            </div>
            {nemesis.killedByWeaponType && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: colors.muted }}>Slain by:</span>{' '}
                {nemesis.killedByWeaponType}
              </div>
            )}
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
          The dungeon's corruption lessens, but new threats stir in the depths.
        </div>

        <button onClick={onDismiss} style={{ ...btnPrimaryStyle, minWidth: 200 }}>
          Continue
        </button>
      </div>
    </ScreenOverlay>
  );
}
