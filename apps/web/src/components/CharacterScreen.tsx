import React, { useState } from 'react';
import type { PlayerHudView, QuestView, NemesisInfo, FactionStanding } from '@dungeon/presenter';
import { ABILITY_DEFINITIONS, MASTERY_THRESHOLDS } from '@dungeon/content';
import { ClickableStatGrid } from './ClickableStatGrid.js';
import { EnchantmentLibrary } from './EnchantmentLibrary.js';
import { EquipmentOverview } from './EquipmentOverview.js';
import { MasteryDetailModal } from './MasteryDetailModal.js';

interface CharacterScreenProps {
  player: PlayerHudView;
  activeQuests?: readonly QuestView[];
}

function getHealthColor(health: number, maxHealth: number): string {
  const pct = Math.round((health / maxHealth) * 100);
  if (pct > 60) return '#4f4';
  if (pct > 30) return '#ff4';
  return '#f44';
}

// Keep old StatGrid for backwards compatibility if needed, but won't be used in new layout
function StatGrid({ player }: { player: PlayerHudView }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: 12,
        fontSize: 12,
      }}
    >
      <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
        <div style={{ color: '#888', marginBottom: 2 }}>HP</div>
        <div style={{ color: getHealthColor(player.health, player.maxHealth), fontSize: 14, fontWeight: 'bold' }}>
          {player.health}/{player.maxHealth}
        </div>
      </div>
      <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
        <div style={{ color: '#888', marginBottom: 2 }}>XP</div>
        <div style={{ color: '#6af', fontSize: 12 }}>{player.experience}</div>
      </div>
      <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
        <div style={{ color: '#888', marginBottom: 2 }}>ATK</div>
        <div style={{ color: '#fa4', fontSize: 14, fontWeight: 'bold' }}>{player.attack}</div>
      </div>
      <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
        <div style={{ color: '#888', marginBottom: 2 }}>DEF</div>
        <div style={{ color: '#fa4', fontSize: 14, fontWeight: 'bold' }}>{player.defense}</div>
      </div>
      {player.accuracy !== undefined && (
        <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
          <div style={{ color: '#888', marginBottom: 2 }}>ACC</div>
          <div style={{ color: '#4af', fontSize: 12 }}>{player.accuracy}%</div>
        </div>
      )}
      {player.evasion !== undefined && (
        <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
          <div style={{ color: '#888', marginBottom: 2 }}>EVA</div>
          <div style={{ color: '#4af', fontSize: 12 }}>{player.evasion}%</div>
        </div>
      )}
      {player.speed !== undefined && (
        <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
          <div style={{ color: '#888', marginBottom: 2 }}>SPD</div>
          <div style={{ color: '#4af', fontSize: 12 }}>{player.speed}</div>
        </div>
      )}
      <div style={{ background: '#1a1a1a', padding: '6px', border: '1px solid #333' }}>
        <div style={{ color: '#888', marginBottom: 2 }}>Gold</div>
        <div style={{ color: '#cc8', fontSize: 14, fontWeight: 'bold' }}>{player.gold}g</div>
      </div>
    </div>
  );
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

function MasterySection({ player }: { player: PlayerHudView }) {
  const [selectedWeaponType, setSelectedWeaponType] = useState<string | null>(null);

  if (!player.weaponMastery || Object.keys(player.weaponMastery).length === 0) return null;

  const calculateTier = (uses: number): number => {
    if (uses < MASTERY_THRESHOLDS[1]) return 0;
    if (uses < MASTERY_THRESHOLDS[2]) return 1;
    return 2;
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>WEAPON MASTERY</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {Object.entries(player.weaponMastery).map(([type, progress]) => {
            const tier = calculateTier(progress);
            const isSelected = selectedWeaponType === type;

            return (
              <button
                key={type}
                onClick={() => setSelectedWeaponType(isSelected ? null : type)}
                style={{
                  padding: '3px 8px',
                  background: isSelected ? '#1a4a3a' : '#1a3a2a',
                  color: tier > 0 ? '#4f4' : '#888',
                  border: `1px solid ${isSelected ? '#2a8a6a' : tier > 0 ? '#2a6a3a' : '#333'}`,
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {type}: {progress}/{tier === 0 ? '10' : '25'} {tier > 0 ? `[T${tier}]` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {selectedWeaponType && (
        <MasteryDetailModal
          weaponType={selectedWeaponType}
          progress={player.weaponMastery[selectedWeaponType as keyof typeof player.weaponMastery]}
          tier={calculateTier(player.weaponMastery[selectedWeaponType as keyof typeof player.weaponMastery])}
          onClose={() => setSelectedWeaponType(null)}
        />
      )}
    </>
  );
}

function QuestSection({ quests }: { quests?: readonly { id: string; title: string; description: string; status: string; rewardGold: number }[] }) {
  if (!quests || quests.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>QUESTS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {quests.map((q) => (
          <div
            key={q.id}
            style={{
              padding: '6px 8px',
              background: '#1a2a3a',
              color: q.status === 'completed' ? '#4f4' : '#aaf',
              border: `1px solid ${q.status === 'completed' ? '#2a5a2a' : '#2a4a6a'}`,
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{q.title}</div>
            <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 2 }}>{q.description}</div>
            <div style={{ fontSize: 10, color: '#888' }}>
              {q.status === 'completed' ? '✓ Complete' : 'In Progress'} • {q.rewardGold}g
            </div>
          </div>
        ))}
      </div>
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

function FactionModal({ factions, onClose }: { factions: readonly FactionStanding[]; onClose: () => void }) {
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
          border: '2px solid #4a6a8a',
          borderRadius: '4px',
          padding: '16px',
          maxWidth: '400px',
          maxHeight: '500px',
          overflow: 'auto',
          color: '#ccc',
          fontFamily: 'monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#6af', marginBottom: 12 }}>FACTION STANDINGS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 12 }}>
          {factions.map((f) => (
            <div key={f.factionId} style={{ padding: '8px', background: '#0a0a1a', border: '1px solid #333' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{f.name}</div>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Disposition: {f.alignment}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 11 }}>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      width: '100%',
                      height: '6px',
                      background: '#0a0a0a',
                      border: '1px solid #333',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round((f.standing / f.maxStanding) * 100)}%`,
                        height: '100%',
                        background: f.standing > 100 ? '#4f4' : f.standing < 100 ? '#f44' : '#ff4',
                      }}
                    />
                  </div>
                </div>
                <div style={{ minWidth: '50px', textAlign: 'right' }}>
                  {f.standing > 100 ? '+' : ''}{f.standing - 100}
                </div>
              </div>
            </div>
          ))}
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

function InfoButtonsSection({
  hasNemesis,
  hasQuests,
  hasFactions,
  questCount,
  onNemesisClick,
  onFactionsClick,
}: {
  hasNemesis: boolean;
  hasQuests: boolean;
  hasFactions: boolean;
  questCount: number;
  onNemesisClick: () => void;
  onFactionsClick: () => void;
}) {
  return (
    <div style={{ marginBottom: 12, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {hasNemesis && (
        <button
          onClick={onNemesisClick}
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
          style={{
            padding: '4px 8px',
            background: '#1a2a3a',
            color: '#6af',
            border: '1px solid #2a4a6a',
            fontSize: 11,
            cursor: 'pointer',
          }}
          disabled
        >
          Quests ({questCount})
        </button>
      )}
      {hasFactions && (
        <button
          onClick={onFactionsClick}
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
    </div>
  );
}


export function CharacterScreen({ player, activeQuests }: CharacterScreenProps) {
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [showNemesisModal, setShowNemesisModal] = useState(false);
  const [showFactionsModal, setShowFactionsModal] = useState(false);

  const hasNemesis = player.nemesisInfo !== null;
  const hasQuests = (activeQuests ?? player.activeQuests ?? []).length > 0;
  const hasFactions = (player.factionStandings ?? []).length > 0;
  const questCount = (activeQuests ?? player.activeQuests ?? []).length;

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
      {/* Header */}
      <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #333' }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 4 }}>
          {player.name}
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>Level {player.level}</div>
      </div>

      <XpProgressSection player={player} />
      <ClickableStatGrid player={player} />
      <EquipmentOverview player={player} />
      <EnchantmentLibrary player={player} />

      <InfoButtonsSection
        hasNemesis={hasNemesis}
        hasQuests={hasQuests}
        hasFactions={hasFactions}
        questCount={questCount}
        onNemesisClick={() => setShowNemesisModal(true)}
        onFactionsClick={() => setShowFactionsModal(true)}
      />

      <QuestSection quests={activeQuests ?? player.activeQuests} />
      <ResistancesSection player={player} />
      <StatusSection player={player} />
      <AbilitiesSection
        player={player}
        selectedAbilityId={selectedAbilityId}
        onSelectAbility={setSelectedAbilityId}
      />
      <MasterySection player={player} />

      {/* Modals */}
      {showNemesisModal && hasNemesis && (
        <NemesisModal nemesis={player.nemesisInfo} onClose={() => setShowNemesisModal(false)} />
      )}
      {showFactionsModal && hasFactions && (
        <FactionModal factions={player.factionStandings} onClose={() => setShowFactionsModal(false)} />
      )}
    </div>
  );
}
