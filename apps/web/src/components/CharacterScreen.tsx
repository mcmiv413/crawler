import React, { useState } from 'react';
import type { PlayerHudView, QuestView } from '@dungeon/presenter';
import { ABILITY_DEFINITIONS } from '@dungeon/content';

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
  onClose,
}: {
  abilityId: string;
  ready: boolean;
  cooldownRemaining: number;
  onClose: () => void;
}) {
  const def = ABILITY_DEFINITIONS[abilityId as keyof typeof ABILITY_DEFINITIONS];
  if (!def) return null;

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

        {def.requiresWeaponTypes && def.requiresWeaponTypes.length > 0 && (
          <div>
            <div style={{ color: '#888', marginBottom: 2 }}>Weapon</div>
            <div style={{ color: '#fa8', textTransform: 'capitalize' }}>{def.requiresWeaponTypes.join(', ')}</div>
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
          onClose={() => onSelectAbility(null)}
        />
      )}
    </div>
  );
}

function MasterySection({ player }: { player: PlayerHudView }) {
  if (!player.weaponMastery || Object.keys(player.weaponMastery).length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>WEAPON MASTERY</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {Object.entries(player.weaponMastery).map(([type, progress]) => (
          <div
            key={type}
            style={{
              padding: '3px 8px',
              background: '#1a3a2a',
              color: progress.tier > 0 ? '#4f4' : '#888',
              border: `1px solid ${progress.tier > 0 ? '#2a6a3a' : '#333'}`,
              fontSize: 11,
            }}
          >
            {type}: {progress.uses}/{progress.tier === 0 ? '10' : '25'} {progress.tier > 0 ? `[T${progress.tier}]` : ''}
          </div>
        ))}
      </div>
    </div>
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

export function CharacterScreen({ player, activeQuests }: CharacterScreenProps) {
  const healthColor = getHealthColor(player.health, player.maxHealth);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);

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

      <StatGrid player={player} />
      <QuestSection quests={activeQuests} />
      <ResistancesSection player={player} />
      <StatusSection player={player} />
      <AbilitiesSection
        player={player}
        selectedAbilityId={selectedAbilityId}
        onSelectAbility={setSelectedAbilityId}
      />
      <MasterySection player={player} />
    </div>
  );
}
