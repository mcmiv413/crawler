import React, { useState } from 'react';
import type { AbilityView, MasteryTierInfo, PlayerHudView, QuestView, FactionView } from '@dungeon/presenter';
import { ClickableStatGrid } from './ClickableStatGrid.js';
import { MasteryDetailModal } from './MasteryDetailModal.js';
import { QuestDetailModal } from './QuestDetailModal.js';
import { FactionDetailModal } from './FactionDetailModal.js';
import { EnchantmentDetailModal } from './EnchantmentDetailModal.js';
import { MagicDetailModal } from './MagicDetailModal.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { TAB_BAR_HEIGHT } from '../config/ui-config.js';

interface CharacterScreenProps {
  player: PlayerHudView;
  activeQuests?: readonly QuestView[];
  sendCommand: (command: unknown) => Promise<void>;
}

function ResistancesSection({ player }: { player: PlayerHudView }) {
  const hasAffinities = Object.values(player.resistances).some((v) => v !== 0);
  if (!hasAffinities) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>AFFINITIES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {Object.entries(player.resistances).map(([type, value]) => {
          if (value === 0) return null;
          const isResistance = value > 0;
          const bgColor = isResistance ? '#1a2a2a' : '#2a1a1a';
          const textColor = isResistance ? '#6f6' : '#f66';
          const borderColor = isResistance ? '#2a4a2a' : '#4a2a2a';

          return (
            <div
              key={type}
              style={{
                padding: '2px 6px',
                background: bgColor,
                color: textColor,
                border: `1px solid ${borderColor}`,
                fontSize: 11,
              }}
            >
              {type}: {value > 0 ? '+' : ''}{Math.round(value)}%
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusSection({ player }: { player: PlayerHudView }) {
  if (player.statuses.length === 0) return null;

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
  ability,
  onClose,
}: {
  ability: AbilityView;
  onClose: () => void;
}) {
  const weaponRequirement = ability.weaponRequirement;
  const targetLabel = ability.requiresTarget
    ? ability.targetRange !== undefined
      ? ability.targetRange.min > 0
        ? `Enemy ${ability.targetRange.min}-${ability.targetRange.max} tiles away`
        : `Enemy within ${ability.targetRange.max} tiles`
      : 'Nearest enemy in range'
    : 'Self';

  return (
    <div style={{ marginBottom: 12, padding: 8, background: '#1a2a3a', border: '1px solid #2a4a6a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#6af' }}>{ability.name}</div>
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
        {ability.description}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, marginBottom: 6 }}>
        <div>
          <div style={{ color: '#888', marginBottom: 2 }}>Cooldown</div>
          <div style={{ color: '#ff8' }}>{ability.cooldown ?? 0} turns</div>
        </div>

        <div>
          <div style={{ color: '#888', marginBottom: 2 }}>Target</div>
          <div style={{ color: '#4af' }}>
            {targetLabel}
          </div>
        </div>

        {weaponRequirement && (
          <div>
            <div style={{ color: '#888', marginBottom: 2 }}>Weapon</div>
            <div style={{ color: weaponRequirement.met ? '#4f4' : '#f88', textTransform: 'capitalize' }}>
              {weaponRequirement.met ? '✓' : '✗'} {weaponRequirement.label}
            </div>
          </div>
        )}

        {(ability.unlockLevel ?? 0) > 0 && (
          <div>
            <div style={{ color: '#888', marginBottom: 2 }}>Unlock</div>
            <div style={{ color: '#8af' }}>Level {ability.unlockLevel}</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: ability.ready ? '#4f4' : '#f88' }}>
        {ability.ready ? '✓ Ready' : `⏱ Cooldown: ${ability.cooldownRemaining} turn${ability.cooldownRemaining === 1 ? '' : 's'}`}
      </div>
    </div>
  );
}

function AbilitiesSection({
  abilities,
  selectedAbilityId,
  onSelectAbility,
}: {
  abilities: readonly AbilityView[];
  selectedAbilityId: string | null;
  onSelectAbility: (id: string | null) => void;
}) {
  if (abilities.length === 0) return null;

  const selectedAbility = abilities.find((a) => a.id === selectedAbilityId);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>ABILITIES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: 4 }}>
        {abilities.map((a) => (
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
          ability={selectedAbility}
          onClose={() => onSelectAbility(null)}
        />
      )}
    </div>
  );
}

function ProgressBarRow({
  label,
  current,
  max,
  fillColor,
  caption,
}: {
  label: string;
  current: number;
  max: number | null;
  fillColor: string;
  caption: string;
}) {
  const percent = max === null || max <= 0
    ? 100
    : Math.min(100, Math.round((current / max) * 100));

  return (
    <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <div>{current.toLocaleString()}</div>
        <div style={{ color: '#888' }}>
          {max === null ? 'MAX' : `/ ${max.toLocaleString()}`}
        </div>
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
            width: `${percent}%`,
            height: '100%',
            background: fillColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{caption}</div>
    </div>
  );
}

function XpProgressSection({ player }: { player: PlayerHudView }) {
  const hasMagicProgress = player.magicExperience !== undefined && player.magicLevel !== undefined
    && player.magicExperienceForNextLevel !== undefined;

  const magicCaption = player.magicExperienceForNextLevel === null
    ? `Magic Lv ${player.magicLevel ?? 1} maxed`
    : `${player.magicExperience ?? 0} / ${player.magicExperienceForNextLevel} XP toward Magic Lv ${(player.magicLevel ?? 1) + 1}`;

  return (
    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ProgressBarRow
        label="EXPERIENCE"
        current={player.experience}
        max={player.experienceForNextLevel}
        fillColor="#4a6"
        caption={`${Math.round((player.experience / player.experienceForNextLevel) * 100)}% to Level ${player.level + 1}`}
      />
      {hasMagicProgress && (
        <ProgressBarRow
          label="MAGIC EXPERIENCE"
          current={player.magicExperience ?? 0}
          max={player.magicExperienceForNextLevel ?? null}
          fillColor="#8a78c8"
          caption={magicCaption}
        />
      )}
    </div>
  );
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
}

function FactionProgressSection({ player, onOpenDetails }: { player: PlayerHudView; onOpenDetails: () => void }) {
  const factions = player.factionProgress;

  if (factions.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ color: '#888', fontSize: 11, fontWeight: 'bold' }}>FACTION PROGRESS</div>
        <button
          onClick={onOpenDetails}
          style={{
            padding: '3px 8px',
            background: '#1a2a1a',
            color: '#4f4',
            border: '1px solid #2a6a2a',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Inspect
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
        {factions.map((faction: FactionView) => (
          <div key={faction.id} style={{ background: '#161616', border: '1px solid #333', padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <div style={{ color: '#ddd', fontSize: 11, fontWeight: 'bold' }}>{faction.name}</div>
              <div style={{ color: '#aaa', fontSize: 10 }}>Power {faction.power}/100</div>
            </div>
            <div style={{ color: '#6af', fontSize: 10, marginBottom: 2 }}>
              {titleCase(faction.powerBand)} · {titleCase(faction.status)}
            </div>
            <div style={{ color: '#aaa', fontSize: 10 }}>
              {faction.leader.state === 'emerged'
                ? `Leader active: ${faction.leader.name}, ${faction.leader.title}`
                : faction.leader.state === 'slain'
                  ? 'Leader slain — faction broken.'
                  : 'No faction leader yet.'}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#14181f', border: '1px solid #2a3a4a', padding: 8 }}>
        <div style={{ color: '#8af', fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>Dungeon Ogre</div>
        <div style={{ color: '#ccc', fontSize: 10 }}>{player.ogreProgress.summaryText}</div>
      </div>
    </div>
  );
}

export function CharacterScreen({ player, activeQuests, sendCommand }: CharacterScreenProps) {
  const { isMobile } = useBreakpoint();
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [showQuestsModal, setShowQuestsModal] = useState(false);
  const [showFactionsModal, setShowFactionsModal] = useState(false);
  const [showMasteryModal, setShowMasteryModal] = useState<string | null>(null);
  const [showEnchantsModal, setShowEnchantsModal] = useState(false);
  const [showMagicModal, setShowMagicModal] = useState(false);

  const quests = activeQuests ?? player.activeQuests;
  const hasQuests = quests.length > 0;
  const hasFactions = player.factionProgress.length > 0;
  const hasEnchantments = player.equippedItems.some(item => item.enchantments.length > 0);
  const masteryTiers = player.weaponMasteryTiers ?? [];
  const hasMasteries = masteryTiers.length > 0;
  const hasRingMagic = player.ringSchoolMasteries.length > 0 || player.learnedSpells.length > 0;
  const learnedRingSpellIds = new Set(player.learnedSpells.map(spell => spell.spellId));
  const visibleAbilities = hasRingMagic
    ? player.abilities.filter(ability => !learnedRingSpellIds.has(ability.id))
    : player.abilities;
  const selectedMasteryInfo =
    showMasteryModal && showMasteryModal !== 'list'
      ? masteryTiers.find(info => info.weaponType === showMasteryModal)
      : undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        padding: '8px',
        background: '#111',
        color: '#ccc',
        fontFamily: 'monospace',
      }}
      >
        {/* Header with player name and gold on same line */}
        <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #333', flexShrink: 0 }}>
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

        <div
          data-testid="character-scroll-content"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            paddingBottom: isMobile ? TAB_BAR_HEIGHT : 0,
          }}
        >
          {/* Experience bar */}
          <XpProgressSection player={player} />

          {/* Core stats */}
          <ClickableStatGrid player={player} />

          {/* Info buttons section - stacked */}
          <div style={{ marginBottom: 12, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
            {hasRingMagic && (
            <button
              onClick={() => setShowMagicModal(true)}
              style={{
                padding: '4px 8px',
                background: '#221633',
                color: '#d6c6ff',
                border: '1px solid #6a4da0',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Magic
            </button>
            )}
          </div>

          {/* Resistances */}
          <ResistancesSection player={player} />

          {hasFactions && (
            <FactionProgressSection player={player} onOpenDetails={() => setShowFactionsModal(true)} />
          )}

          {/* Status effects */}
          <StatusSection player={player} />

          {/* Abilities */}
          <AbilitiesSection
            abilities={visibleAbilities}
            selectedAbilityId={selectedAbilityId}
            onSelectAbility={setSelectedAbilityId}
          />
        </div>

      {/* Modals */}
      {showQuestsModal && hasQuests && (
        <QuestDetailModal quests={quests} onClose={() => setShowQuestsModal(false)} sendCommand={sendCommand} />
      )}
      {showFactionsModal && hasFactions && (
        <FactionDetailModal factions={player.factionProgress} onClose={() => setShowFactionsModal(false)} />
      )}
      {showEnchantsModal && hasEnchantments && (
        <EnchantmentDetailModal player={player} onClose={() => setShowEnchantsModal(false)} />
      )}
      {showMasteryModal === 'list' && hasMasteries && (
        <MasteryListModal
          player={player}
          onSelectWeapon={(type) => setShowMasteryModal(type)}
          onClose={() => setShowMasteryModal(null)}
        />
      )}
      {showMasteryModal && showMasteryModal !== 'list' && selectedMasteryInfo !== undefined && (
        <MasteryDetailModal
          mastery={selectedMasteryInfo}
          onClose={() => setShowMasteryModal(null)}
        />
      )}
      {showMagicModal && hasRingMagic && (
        <MagicDetailModal
          player={player}
          onClose={() => setShowMagicModal(false)}
        />
      )}
    </div>
  );
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
  const masteryTiers = player.weaponMasteryTiers ?? [];
  if (masteryTiers.length === 0) return null;

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
          {masteryTiers.map((mastery: MasteryTierInfo) => {
            return (
              <button
                key={mastery.weaponType}
                onClick={() => onSelectWeapon(mastery.weaponType)}
                style={{
                  padding: '8px 12px',
                  background: '#1a3a2a',
                  color: mastery.tier > 0 ? '#4f4' : '#888',
                  border: '1px solid #2a6a3a',
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'left',
                  textTransform: 'capitalize',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{mastery.weaponType}</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>
                  {mastery.listProgressLabel} {mastery.tier > 0 ? `[T${mastery.tier}]` : ''}
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
