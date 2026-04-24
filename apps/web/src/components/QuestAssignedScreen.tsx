import React from 'react';
import type { GameView, NpcView } from '@dungeon/presenter';
import { btnPrimaryStyle, colors } from '../styles.js';
import { ScreenOverlay, InfoCard, SectionLabel } from './ui/index.js';

interface QuestAssignedScreenProps {
  view: GameView;
  questTitle: string;
  questDescription: string;
  rewardGold: number;
  giverNpc: NpcView | undefined;
  onDismiss: () => void;
}

export function QuestAssignedScreen({
  questTitle,
  questDescription,
  rewardGold,
  giverNpc,
  onDismiss,
}: QuestAssignedScreenProps) {
  return (
    <ScreenOverlay>
      <div style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
        <h2 style={{ color: colors.steel, fontSize: 28, marginBottom: 10 }}>New Quest</h2>

        <div style={{ color: colors.steel, fontSize: 13, marginBottom: 20 }}>
          {giverNpc ? `${giverNpc.name} has a task for you.` : 'A new opportunity awaits.'}
        </div>

        <InfoCard borderColor={colors.steel} marginBottom={20} style={{ padding: 14 }}>
          <SectionLabel label={questTitle} color={colors.steel} />
          <div
            style={{
              textAlign: 'left',
              fontSize: 12,
              color: colors.text,
              lineHeight: 1.8,
              marginBottom: 12,
            }}
          >
            {questDescription}
          </div>
          <div
            style={{
              borderTop: `1px solid ${colors.border2}`,
              paddingTop: 12,
              textAlign: 'center',
            }}
          >
            <div style={{ color: colors.gold, fontSize: 13, fontWeight: 600 }}>
              Reward: {rewardGold}g
            </div>
          </div>
        </InfoCard>

        <button
          onClick={onDismiss}
          style={{ ...btnPrimaryStyle, minWidth: 200, padding: '10px 24px' }}
        >
          Accept Quest
        </button>
      </div>
    </ScreenOverlay>
  );
}
