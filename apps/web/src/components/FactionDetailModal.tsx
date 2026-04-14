import React, { useState } from 'react';
import type { FactionStanding } from '@dungeon/presenter';

interface FactionDetailModalProps {
  factions: readonly FactionStanding[];
  onClose: () => void;
}

export function FactionDetailModal({ factions, onClose }: FactionDetailModalProps) {
  const [selectedFactionId, setSelectedFactionId] = useState<string>(factions.length > 0 ? factions[0]!.factionId : '');
  const selectedFaction = selectedFactionId ? factions.find(f => f.factionId === selectedFactionId) : null;

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
          border: '2px solid #4a8a6a',
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
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#4f4', marginBottom: 12 }}>FACTIONS</div>

        <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
          {/* Faction List */}
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
            {factions.map((f) => (
              <button
                key={f.factionId}
                onClick={() => setSelectedFactionId(f.factionId)}
                style={{
                  padding: '6px 8px',
                  background: selectedFactionId === f.factionId ? '#1a4a2a' : '#1a2a1a',
                  color: f.standing > 100 ? '#4f4' : f.standing < 100 ? '#f44' : '#ff4',
                  border: `1px solid ${selectedFactionId === f.factionId ? '#2a8a4a' : '#2a5a2a'}`,
                  fontSize: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
                title={f.name}
              >
                {f.name}
              </button>
            ))}
          </div>

          {/* Faction Details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {selectedFaction ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#4f4', marginBottom: 4 }}>
                    {selectedFaction.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>
                    Disposition: {selectedFaction.alignment}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold' }}>STANDING</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          width: '100%',
                          height: '8px',
                          background: '#0a0a0a',
                          border: '1px solid #333',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round((selectedFaction.standing / selectedFaction.maxStanding) * 100)}%`,
                            height: '100%',
                            background: selectedFaction.standing > 100 ? '#4f4' : selectedFaction.standing < 100 ? '#f44' : '#ff4',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ minWidth: '60px', textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: selectedFaction.standing > 100 ? '#4f4' : selectedFaction.standing < 100 ? '#f44' : '#ff4' }}>
                        {selectedFaction.standing > 100 ? '+' : ''}{selectedFaction.standing - 100}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedFaction.description && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold' }}>DESCRIPTION</div>
                    <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
                      {selectedFaction.description}
                    </div>
                  </div>
                )}

                {selectedFaction.enemiesInCurrentDungeon && selectedFaction.enemiesInCurrentDungeon.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold' }}>ENEMIES IN DUNGEON</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {selectedFaction.enemiesInCurrentDungeon.map((enemy, idx) => (
                        <div key={idx} style={{ fontSize: 10, color: '#f88' }}>
                          • {enemy}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#888', fontSize: 11 }}>Select a faction to view details</div>
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
