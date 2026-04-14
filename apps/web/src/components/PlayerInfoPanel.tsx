import { useState } from 'react';
import type { GameView } from '@dungeon/presenter';
import { QuestDetailModal } from './QuestDetailModal.js';
import { FactionDetailModal } from './FactionDetailModal.js';
import { EnchantmentDetailModal } from './EnchantmentDetailModal.js';
import { MasteryDetailModal } from './MasteryDetailModal.js';
import { MASTERY_THRESHOLDS } from '@dungeon/content';

interface PlayerInfoPanelProps {
  view: GameView;
}

export function PlayerInfoPanel({ view }: PlayerInfoPanelProps) {
  const [showQuestsModal, setShowQuestsModal] = useState(false);
  const [showFactionsModal, setShowFactionsModal] = useState(false);
  const [showMasteryModal, setShowMasteryModal] = useState<string | null>(null);
  const [showEnchantsModal, setShowEnchantsModal] = useState(false);

  const quests = view.activeQuests ?? [];
  const hasFactions = (view.player.factionStandings ?? []).length > 0;
  const hasEnchantments = (view.player.equippedItems ?? []).some(item => item.enchantments.length > 0);
  const hasMasteries = view.player.weaponMastery && Object.keys(view.player.weaponMastery).length > 0;

  return (
    <>
      {/* Vertical info panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginBottom: 6,
        }}
      >
        {quests.length > 0 && (
          <button
            onClick={() => setShowQuestsModal(true)}
            style={{
              padding: '4px 8px',
              background: '#1a2a3a',
              color: '#6af',
              border: '1px solid #2a4a6a',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            | QUESTS ({quests.length})
          </button>
        )}
        {hasFactions && (
          <button
            onClick={() => setShowFactionsModal(true)}
            style={{
              padding: '4px 8px',
              background: '#1a2a1a',
              color: '#4f4',
              border: '1px solid #2a6a2a',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            | FACTIONS
          </button>
        )}
        {hasMasteries && (
          <button
            onClick={() => setShowMasteryModal('list')}
            style={{
              padding: '4px 8px',
              background: '#2a1a2a',
              color: '#f0a',
              border: '1px solid #6a2a6a',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            | MASTERIES
          </button>
        )}
        {hasEnchantments ? (
          <button
            onClick={() => setShowEnchantsModal(true)}
            style={{
              padding: '4px 8px',
              background: '#1a3a2a',
              color: '#6f6',
              border: '1px solid #2a6a4a',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            | ENCHANTMENTS
          </button>
        ) : null}
      </div>

      {/* Modals */}
      {showQuestsModal && quests.length > 0 && (
        <QuestDetailModal quests={quests} onClose={() => setShowQuestsModal(false)} />
      )}
      {showFactionsModal && hasFactions && (
        <FactionDetailModal factions={view.player.factionStandings} onClose={() => setShowFactionsModal(false)} />
      )}
      {showEnchantsModal && hasEnchantments && (
        <EnchantmentDetailModal player={view.player} onClose={() => setShowEnchantsModal(false)} />
      )}
      {showMasteryModal === 'list' && view.player.weaponMastery && (
        <MasteryListModal
          player={view.player}
          onSelectWeapon={(type) => setShowMasteryModal(type)}
          onClose={() => setShowMasteryModal(null)}
        />
      )}
      {showMasteryModal && showMasteryModal !== 'list' && view.player.weaponMastery && (
        <MasteryDetailModal
          weaponType={showMasteryModal}
          progress={view.player.weaponMastery[showMasteryModal as keyof typeof view.player.weaponMastery]}
          tier={calculateMasteryTier(view.player.weaponMastery[showMasteryModal as keyof typeof view.player.weaponMastery])}
          onClose={() => setShowMasteryModal(null)}
        />
      )}
    </>
  );
}

function calculateMasteryTier(uses: number): number {
  if (uses < MASTERY_THRESHOLDS[1]) return 0;
  if (uses < MASTERY_THRESHOLDS[2]) return 1;
  return 2;
}

function MasteryListModal({
  player,
  onSelectWeapon,
  onClose,
}: {
  player: any;
  onSelectWeapon: (type: string) => void;
  onClose: () => void;
}) {
  if (!player.weaponMastery || Object.keys(player.weaponMastery).length === 0) return null;

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
          border: '2px solid #6a2a6a',
          borderRadius: '4px',
          padding: '16px',
          maxWidth: '300px',
          color: '#ccc',
          fontFamily: 'monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 14, fontWeight: 'bold', color: '#f0a', marginBottom: 12 }}>Masteries</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(player.weaponMastery).map(([type, progress]: [string, any]) => (
            <button
              key={type}
              onClick={() => onSelectWeapon(type)}
              style={{
                padding: '6px 8px',
                background: '#2a1a2a',
                color: '#f0a',
                border: '1px solid #6a2a6a',
                cursor: 'pointer',
                fontSize: 11,
                textAlign: 'left',
              }}
            >
              <div style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{type}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>
                {progress.uses} / {progress.tier === 0 ? '10' : '25'} {progress.tier > 0 ? `[T${progress.tier}]` : ''}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 12,
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
