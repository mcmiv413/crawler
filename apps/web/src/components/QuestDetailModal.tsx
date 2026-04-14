import React, { useState } from 'react';
import type { QuestView } from '@dungeon/presenter';

interface QuestDetailModalProps {
  quests: readonly QuestView[];
  onClose: () => void;
}

export function QuestDetailModal({ quests, onClose }: QuestDetailModalProps) {
  const [selectedQuestId, setSelectedQuestId] = useState<string>(quests.length > 0 ? quests[0]!.id : '');
  const selectedQuest = selectedQuestId ? quests.find(q => q.id === selectedQuestId) : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a2a',
          border: '2px solid #4a7a8a',
          borderRadius: '4px',
          padding: '16px',
          maxWidth: '500px',
          color: '#ccc',
          fontFamily: 'monospace',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#6af', marginBottom: 12 }}>QUESTS</div>

        <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
          {/* Quest List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              flex: '0 0 150px',
              overflowY: 'auto',
              borderRight: '1px solid #333',
              paddingRight: '12px',
            }}
          >
            {quests.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelectedQuestId(q.id)}
                style={{
                  padding: '6px 8px',
                  background: selectedQuestId === q.id ? '#2a4a7a' : '#1a2a3a',
                  color: q.status === 'complete' ? '#4f4' : '#6af',
                  border: `1px solid ${selectedQuestId === q.id ? '#4a8aaf' : '#2a4a6a'}`,
                  fontSize: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
                title={q.title}
              >
                {q.title}
              </button>
            ))}
          </div>

          {/* Quest Details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {selectedQuest ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#6af', marginBottom: 4 }}>
                    {selectedQuest.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>
                    Status: {selectedQuest.status === 'complete' ? (
                      <span style={{ color: '#4f4' }}>✓ Completed</span>
                    ) : (
                      <span style={{ color: '#ff8' }}>In Progress</span>
                    )}
                  </div>
                </div>

                {selectedQuest.description && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold' }}>DESCRIPTION</div>
                    <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.4 }}>
                      {selectedQuest.description}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold' }}>REWARD</div>
                  <div style={{ fontSize: 12, color: '#cc8', fontWeight: 'bold' }}>
                    {selectedQuest.rewardGold}g
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: '#888', fontSize: 11 }}>Select a quest to view details</div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            padding: '6px 12px',
            background: '#2a2a3a',
            color: '#ccc',
            border: '1px solid #444',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
