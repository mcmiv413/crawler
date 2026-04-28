import React, { useState } from 'react';
import type { QuestView } from '@dungeon/presenter';
import { colors, FONT_STACK, btnStyle } from '../styles.js';
import { ModalBackdrop, ModalCard, SectionLabel } from './ui/index.js';

interface QuestDetailModalProps {
  quests: readonly QuestView[];
  onClose: () => void;
  sendCommand: (command: unknown) => Promise<void>;
}

export function QuestDetailModal({ quests, onClose, sendCommand }: QuestDetailModalProps) {
  const [selectedQuestId, setSelectedQuestId] = useState<string>(
    quests.length > 0 ? quests[0]!.id : '',
  );
  const selectedQuest = selectedQuestId ? quests.find((q) => q.id === selectedQuestId) : null;

  const handleTurnInQuest = async () => {
    if (!selectedQuest) return;
    try {
      await sendCommand({ type: 'TOWN_ACTION', action: 'turn_in_quest', targetId: selectedQuest.id });
    } catch (err) {
      console.error('Failed to turn in quest:', err);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="QUESTS" onClose={onClose} accentColor={colors.steel}>
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {/* Quest List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: '0 0 150px',
              overflowY: 'auto',
              borderRight: `1px solid ${colors.border2}`,
              paddingRight: 10,
            }}
          >
            {quests.map((q) => {
              const isSelected = selectedQuestId === q.id;
              const isComplete = q.status === 'rewarded';
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuestId(q.id)}
                  style={{
                    padding: '6px 8px',
                    background: isSelected ? colors.card : colors.inset,
                    color: isComplete ? colors.lime : colors.steel,
                    border: `1px solid ${isSelected ? colors.border : colors.border2}`,
                    borderRadius: '2px',
                    fontSize: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    fontFamily: FONT_STACK,
                  }}
                  title={q.title}
                >
                  {q.title}
                </button>
              );
            })}
          </div>

          {/* Quest Details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {selectedQuest ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.steel, marginBottom: 4 }}>
                    {selectedQuest.title}
                  </div>
                  <div style={{ fontSize: 10, color: colors.muted }}>
                    Status:{' '}
                    {selectedQuest.status === 'rewarded' ? (
                      <span style={{ color: colors.lime }}>✓ Completed</span>
                    ) : selectedQuest.status === 'ready_to_turn_in' ? (
                      <span style={{ color: colors.lime }}>Ready to Turn In</span>
                    ) : (
                      <span style={{ color: colors.gold }}>In Progress</span>
                    )}
                  </div>
                </div>

                {selectedQuest.description && (
                  <div style={{ marginBottom: 12 }}>
                    <SectionLabel label="Description" />
                    <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.4 }}>
                      {selectedQuest.description}
                    </div>
                  </div>
                )}

                {selectedQuest.objectiveText && (
                  <div style={{ marginBottom: 12 }}>
                    <SectionLabel label="Objective" />
                    <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.4 }}>
                      {selectedQuest.objectiveText}
                    </div>
                    {selectedQuest.progress > 0 && (
                      <div style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>
                        Progress: {selectedQuest.progress}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <SectionLabel label="Reward" />
                  <div style={{ fontSize: 12, color: colors.gold, fontWeight: 600 }}>
                    {selectedQuest.rewardGold}g
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: colors.muted, fontSize: 11 }}>
                Select a quest to view details
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {selectedQuest && selectedQuest.status === 'ready_to_turn_in' && (
            <button
              onClick={handleTurnInQuest}
              style={{
                ...btnStyle,
                padding: '6px 12px',
                fontSize: 11,
                flex: 1,
                backgroundColor: colors.lime,
                color: '#000',
              }}
            >
              Turn In Quest
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              ...btnStyle,
              padding: '6px 12px',
              fontSize: 11,
              flex: selectedQuest?.status === 'ready_to_turn_in' ? 1 : 'initial',
            }}
          >
            Close
          </button>
        </div>
      </ModalCard>
    </ModalBackdrop>
  );
}
