import React, { useState } from 'react';
import type { PlayerHudView, QuestView, NemesisInfo, FactionStanding } from '@dungeon/presenter';
import { ABILITY_DEFINITIONS, MASTERY_THRESHOLDS } from '@dungeon/content';
import { ClickableStatGrid } from './ClickableStatGrid.js';
import { MasteryDetailModal } from './MasteryDetailModal.js';
import { QuestDetailModal } from './QuestDetailModal.js';
import { FactionDetailModal } from './FactionDetailModal.js';
import { EnchantmentDetailModal } from './EnchantmentDetailModal.js';

interface CharacterScreenProps {
  player: PlayerHudView;
  activeQuests?: readonly QuestView[];
}

function ResistancesSection({ player }: { player: PlayerHudView }) {
  if (!player.resistances) return null;
  const hasResistances = Object.keys(player.resistances).some((r) => (player.resistances as Record<string, number>)[r]! > 0);
  if (!hasResistances) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>RESISTANCES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {Object.entries(player.resistances).map(([type, value]) =>
          value > 0 ? (
            <div
              key={type}
              style={{
                padding: '2px 6px',
                background: '#1a2a2a',
                color: '#6f6',
                border: '1px solid #2a4a2a',
                fontSize: 11,
              }}
            >
              {type}: +{Math.round(value * 100)}%
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

function StatusSection({ player }: { player: PlayerHudView }) {
  if (!player.statuses || player.statuses.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>STATUS EFFECTS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {player.statuses.map((s) => (
          <div
            key={s.id}
            style={{
              padding: '2px 6px',
              background: s.beneficial ? '#1a4a1a' : '#4a1a1a',
              color: s.beneficial ? '#4f4' : '#f44',
              border: `1px solid ${s.beneficial ? '#2a6a2a' : '#6a2a2a'}`,
              fontSize: 11,
            }}
          >
            {s.name} ({s.turnsRemaining})
          </div>
        ))}
      </div>
    </div>
  );
}

function AbilityDetailPanel({
  abilityId,
  ready,
  cooldownRemaining,
  player,
  onClose,
}: {
  abilityId: string;
  ready: boolean;
  cooldownRemaining: number;
  player: PlayerHudView;
  onClose: () => void;
}) {
  const def = ABILITY_DEFINITIONS[abilityId as keyof typeof ABILITY_DEFINITIONS];
  if (!def) return null;

  // Check weapon requirement status
  let equippedWeaponType: string | null = null;
  const weaponItem = player.equippedItems.find(i => i.slot === 'weapon');
  if (weaponItem) {
    // We'd need the weapon type from the registry, but for now we can show it's equipped
    equippedWeaponType = 'equipped';
  }

  const hasWeaponRequirement = def.requiresWeaponTypes && def.requiresWeaponTypes.length > 0;
  const weaponRequirementMet = !hasWeaponRequirement || equippedWeaponType !== null;

  return (
    <div style={{ marginBottom: 12, padding: 8, background: '#1a2a3a', border: '1px solid #2a4a6a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#6af' }}>{def.name}</div>
        <button
          onClick={onClose}
          style={{
            padding: '2px 6px',
            background: '#333',
            color: '#aaa',
            border: '1px solid #555',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, lineHeight: 1.4 }}>
        {def.description}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, marginBottom: 6 }}>
        <div>
          <div style={{ color: '#888', marginBottom: 2 }}>Cooldown</div>
          <div style={{ color: '#ff8' }}>{def.cooldown} turns</div>
        </div>

        <div>
          <div style={{ color: '#888', marginBottom: 2 }}>Target</div>
          <div style={{ color: '#4af' }}>
            {def.requiresTarget ? 'Nearest enemy in range' : 'Self'}
          </div>
        </div>

        {hasWeaponRequirement && (
          <div>
            <div style={{ color: '#888', marginBottom: 2 }}>Weapon</div>
            <div style={{ color: weaponRequirementMet ? '#4f4' : '#f88', textTransform: 'capitalize' }}>
              {weaponRequirementMet ? '✓' : '✗'} {def.requiresWeaponTypes!.join(', ')}
            </div>
          </div>
        )}

        {def.unlockLevel > 0 && (
          <div>
            <div style={{ color: '#888', marginBottom: 2 }}>Unlock</div>
            <div style={{ color: '#8af' }}>Level {def.unlockLevel}</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: ready ? '#4f4' : '#f88' }}>
        {ready ? '✓ Ready' : `⏱ Cooldown: ${cooldownRemaining} turn${cooldownRemaining === 1 ? '' : 's'}`}
      </div>
    </div>
  );
}

function AbilitiesSection({
  player,
  selectedAbilityId,
  onSelectAbility,
}: {
  player: PlayerHudView;
  selectedAbilityId: string | null;
  onSelectAbility: (id: string | null) => void;
}) {
  if (!player.abilities || player.abilities.length === 0) return null;

  const selectedAbility = player.abilities.find((a) => a.id === selectedAbilityId);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>ABILITIES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: 4 }}>
        {player.abilities.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelectAbility(selectedAbilityId === a.id ? null : a.id)}
            style={{
              padding: '3px 8px',
              background: selectedAbilityId === a.id ? '#2a4a7a' : a.ready ? '#1a2a4a' : '#2a2a2a',
              color: a.ready ? '#6af' : '#666',
              border: `1px solid ${selectedAbilityId === a.id ? '#4a8aaf' : a.ready ? '#2a4a7a' : '#444'}`,
              fontSize: 11,
              cursor: 'pointer',
            }}
            title={a.description}
          >
            {a.name}{a.ready ? '' : ` (${a.cooldownRemaining})`}
          </button>
        ))}
      </div>

      {selectedAbility && (
        <AbilityDetailPanel
          abilityId={selectedAbility.id}
          ready={selectedAbility.ready}
          cooldownRemaining={selectedAbility.cooldownRemaining}
          player={player}
          onClose={() => onSelectAbility(null)}
        />
      )}
    </div>
  );
}

function XpProgressSection({ player }: { player: PlayerHudView }) {
  const xpPercent = Math.round((player.experience / player.experienceForNextLevel) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>EXPERIENCE</div>
      <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333', marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <div>{player.experience.toLocaleString()}</div>
          <div style={{ color: '#888' }}>/ {player.experienceForNextLevel.toLocaleString()}</div>
        </div>
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
              width: `${xpPercent}%`,
              height: '100%',
              background: '#4a6',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{xpPercent}% to Level {player.level + 1}</div>
      </div>
    </div>
  );
}

function NemesisModal({ nemesis, onClose }: { nemesis: NemesisInfo; onClose: () => void }) {
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
          border: '2px solid #8a4a4a',
          borderRadius: '4px',
          padding: '16px',
          maxWidth: '400px',
          color: '#ccc',
          fontFamily: 'monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f88', marginBottom: 12 }}>{nemesis.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 12 }}>
          <div>
            <div style={{ color: '#888' }}>Title</div>
            <div>{nemesis.title}</div>
          </div>
          <div>
            <div style={{ color: '#888' }}>Threat Level</div>
            <div style={{ textTransform: 'capitalize' }}>{nemesis.rarity}</div>
          </div>
          <div>
            <div style={{ color: '#888' }}>Promotion Stage</div>
            <div>{nemesis.promotionStage}</div>
          </div>
          <div>
            <div style={{ color: '#888' }}>Times Defeated</div>
            <div style={{ color: '#4f4' }}>{nemesis.defeats}</div>
          </div>
          {nemesis.lastSeenFloor !== null && (
            <div>
              <div style={{ color: '#888' }}>Last Encountered</div>
              <div>Floor {nemesis.lastSeenFloor}</div>
            </div>
          )}
          <div>
            <div style={{ color: '#888' }}>Next Appearance</div>
            <div>Floor {nemesis.nextPossibleFloor}+</div>
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


export function CharacterScreen({ player, activeQuests }: CharacterScreenProps) {
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [showNemesisModal, setShowNemesisModal] = useState(false);
  const [showQuestsModal, setShowQuestsModal] = useState(false);
  const [showFactionsModal, setShowFactionsModal] = useState(false);
  const [showMasteryModal, setShowMasteryModal] = useState<string | null>(null);
  const [showEnchantsModal, setShowEnchantsModal] = useState(false);

  const quests = (activeQuests ?? player.activeQuests ?? []);
  const hasNemesis = player.nemesisInfo !== null;
  const hasQuests = quests.length > 0;
  const hasFactions = (player.factionStandings ?? []).length > 0;
  const hasEnchantments = player.equippedItems.some(item => item.enchantments.length > 0);
  const hasMasteries = player.weaponMastery && Object.keys(player.weaponMastery).length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'auto',
        padding: '8px',
        background: '#111',
        color: '#ccc',
        fontFamily: 'monospace',
      }}
    >
      {/* Header with player name and gold on same line */}
      <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>
            {player.name}
          </div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#cc8' }}>
            {player.gold}g
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>Level {player.level}</div>
      </div>

      {/* Experience bar */}
      <XpProgressSection player={player} />

      {/* Core stats */}
      <ClickableStatGrid player={player} />

      {/* Info buttons section - stacked */}
      <div style={{ marginBottom: 12, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {hasNemesis && (
          <button
            onClick={() => setShowNemesisModal(true)}
            style={{
              padding: '4px 8px',
              background: '#2a1a1a',
              color: '#f88',
              border: '1px solid #6a2a2a',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Nemesis
          </button>
        )}
        {hasQuests && (
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
            Quests ({quests.length})
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
            Factions
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
            Masteries
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
            Enchantments
          </button>
        ) : (
          <button
            disabled
            style={{
              padding: '4px 8px',
              background: '#0a1a0a',
              color: '#444',
              border: '1px solid #1a3a1a',
              fontSize: 11,
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
          >
            Enchantments
          </button>
        )}
      </div>

      {/* Resistances */}
      <ResistancesSection player={player} />

      {/* Status effects */}
      <StatusSection player={player} />

      {/* Abilities */}
      <AbilitiesSection
        player={player}
        selectedAbilityId={selectedAbilityId}
        onSelectAbility={setSelectedAbilityId}
      />

      {/* Modals */}
      {showNemesisModal && hasNemesis && (
        <NemesisModal nemesis={player.nemesisInfo} onClose={() => setShowNemesisModal(false)} />
      )}
      {showQuestsModal && hasQuests && (
        <QuestDetailModal quests={quests} onClose={() => setShowQuestsModal(false)} />
      )}
      {showFactionsModal && hasFactions && (
        <FactionDetailModal factions={player.factionStandings} onClose={() => setShowFactionsModal(false)} />
      )}
      {showEnchantsModal && hasEnchantments && (
        <EnchantmentDetailModal player={player} onClose={() => setShowEnchantsModal(false)} />
      )}
      {showMasteryModal === 'list' && player.weaponMastery && (
        <MasteryListModal
          player={player}
          onSelectWeapon={(type) => setShowMasteryModal(type)}
          onClose={() => setShowMasteryModal(null)}
        />
      )}
      {showMasteryModal && showMasteryModal !== 'list' && player.weaponMastery && (
        <MasteryDetailModal
          weaponType={showMasteryModal}
          progress={player.weaponMastery[showMasteryModal as keyof typeof player.weaponMastery]}
          tier={calculateMasteryTier(player.weaponMastery[showMasteryModal as keyof typeof player.weaponMastery])}
          onClose={() => setShowMasteryModal(null)}
        />
      )}
    </div>
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
  player: PlayerHudView;
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
          border: '2px solid #8a6a4a',
          borderRadius: '4px',
          padding: '16px',
          maxWidth: '300px',
          color: '#ccc',
          fontFamily: 'monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f0a', marginBottom: 12 }}>WEAPON MASTERIES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 16 }}>
          {Object.entries(player.weaponMastery).map(([type, progress]) => {
            const tier = calculateMasteryTier(progress);
            return (
              <button
                key={type}
                onClick={() => onSelectWeapon(type)}
                style={{
                  padding: '8px 12px',
                  background: '#1a3a2a',
                  color: tier > 0 ? '#4f4' : '#888',
                  border: '1px solid #2a6a3a',
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'left',
                  textTransform: 'capitalize',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{type}</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>
                  {progress}/{tier === 0 ? '10' : '25'} {tier > 0 ? `[T${tier}]` : ''}
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%',
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
