import type { PlayerHudView } from '@dungeon/presenter';

interface PlayerHudProps {
  player: PlayerHudView;
  compact?: boolean;
}

// Format biome ID to readable name (e.g., 'stone_crypt' -> 'Stone Crypt')
function formatBiomeName(biomeId: string | null): string {
  if (!biomeId) return '?';
  return biomeId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get biome color for visual distinction
function getBiomeColor(biomeId: string | null): string {
  switch (biomeId) {
    case 'stone_crypt': return '#888';      // Gray
    case 'goblin_warrens': return '#cc8';   // Orange/brown
    case 'moss_caverns': return '#484';     // Green
    case 'frozen_depths': return '#88f';    // Blue
    case 'forest': return '#4a4';           // Green
    case 'volcanic': return '#f44';         // Red/orange
    case 'crystal_cave': return '#f8f';     // Magenta
    default: return '#aaa';                 // Default gray
  }
}

export function PlayerHud({ player, compact = false }: PlayerHudProps) {
  const healthPct = Math.round((player.health / player.maxHealth) * 100);
  const healthColor = healthPct > 60 ? '#4f4' : healthPct > 30 ? '#ff4' : '#f44';
  const biomeColor = getBiomeColor(player.biomeId);
  const biomeName = formatBiomeName(player.biomeId);

  if (compact) {
    return (
      <div style={{ marginBottom: 8, padding: 6, border: '1px solid #333', background: '#1a1a1a', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ color: '#fff', minWidth: 80 }}>{player.name}</strong>
          <span style={{ color: '#888' }}>Lv.{player.level}</span>
          <span style={{ color: '#888' }}>Floor {player.floor}</span>
          <span>
            HP: <span style={{ color: healthColor }}>{player.health}/{player.maxHealth}</span>
          </span>
          <span style={{ color: biomeColor, fontSize: 11 }}>⬤ {biomeName}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10, padding: 8, border: '1px solid #333', background: '#1a1a1a' }}>
      <div><strong style={{ color: '#fff' }}>{player.name}</strong> Lv.{player.level} | Floor {player.floor} | XP: {player.experience}</div>
      <div>
        HP: <span style={{ color: healthColor }}>{player.health}/{player.maxHealth}</span> | <span style={{ color: biomeColor }}>⬤ {biomeName}</span> |
        ATK: {player.attack} | DEF: {player.defense} |
        {player.accuracy !== undefined && <>ACC: {player.accuracy} | </>}
        {player.evasion !== undefined && <>EVA: {player.evasion} | </>}
        {player.speed !== undefined && <>SPD: {player.speed} | </>}
        Gold: <span style={{ color: '#cc8' }}>{player.gold}</span>
      </div>
      {player.resistances && Object.keys(player.resistances).filter(r => (player.resistances as Record<string, number>)[r]! > 0).length > 0 && (
        <div style={{ fontSize: 10, marginTop: 2 }}>
          <span style={{ color: '#888' }}>Resistances: </span>
          {Object.entries(player.resistances).map(([type, value]) => value > 0 && (
            <span key={type} style={{
              marginRight: 4, padding: '1px 4px',
              background: '#1a2a2a',
              color: '#6f6',
              border: '1px solid #2a4a2a',
            }}>
              {type}: +{Math.round(value * 100)}%
            </span>
          ))}
        </div>
      )}
      {player.statuses && player.statuses.length > 0 && (
        <div style={{ fontSize: 10, marginTop: 2 }}>
          {player.statuses.map(s => (
            <span key={s.id} style={{
              marginRight: 4, padding: '1px 4px',
              background: s.beneficial ? '#1a4a1a' : '#4a1a1a',
              color: s.beneficial ? '#4f4' : '#f44',
              border: `1px solid ${s.beneficial ? '#2a6a2a' : '#6a2a2a'}`,
            }}>
              {s.name} ({s.turnsRemaining})
            </span>
          ))}
        </div>
      )}
      {player.abilities && player.abilities.length > 0 && (
        <div style={{ fontSize: 10, marginTop: 4 }}>
          <span style={{ color: '#888' }}>Abilities: </span>
          {player.abilities.map(a => (
            <span key={a.id} title={a.description} style={{
              marginRight: 4, padding: '1px 5px',
              background: a.ready ? '#1a2a4a' : '#2a2a2a',
              color: a.ready ? '#6af' : '#666',
              border: `1px solid ${a.ready ? '#2a4a7a' : '#444'}`,
              cursor: 'help',
            }}>
              {a.name}{a.ready ? '' : ` (${a.cooldownRemaining})`}
            </span>
          ))}
        </div>
      )}
      {player.weaponMastery && Object.keys(player.weaponMastery).length > 0 && (
        <div style={{ fontSize: 10, marginTop: 4 }}>
          <span style={{ color: '#888' }}>Mastery: </span>
          {Object.entries(player.weaponMastery).map(([type, progress]) => (
            <span key={type} style={{
              marginRight: 4, padding: '1px 5px',
              background: '#1a3a2a',
              color: progress.tier > 0 ? '#4f4' : '#888',
              border: `1px solid ${progress.tier > 0 ? '#2a6a3a' : '#333'}`,
            }}>
              {type}: {progress.uses}/{progress.tier === 0 ? '10' : '25'} {progress.tier > 0 ? `[T${progress.tier}]` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
