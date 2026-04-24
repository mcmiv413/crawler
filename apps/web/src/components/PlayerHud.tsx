import type { PlayerHudView } from '@dungeon/presenter';
import { colors, hpBarColor, FONT_STACK } from '../styles.js';

interface PlayerHudProps {
  player: PlayerHudView;
  compact?: boolean;
}

function formatBiomeName(biomeId: string | null): string {
  if (!biomeId) return '?';
  return biomeId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── Shared bar primitive ──────────────────────────────────────────────────
function StatBar({
  label,
  fillColor,
  pct,
  valueLabel,
}: {
  label: string;
  fillColor: string;
  pct: number;
  valueLabel: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 10, color: colors.label, width: 20, flexShrink: 0 }}>
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: colors.inset,
          border: `1px solid ${colors.border2}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            height: '100%',
            background: fillColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: colors.text, width: 50, textAlign: 'right', flexShrink: 0 }}>
        {valueLabel}
      </span>
    </div>
  );
}

// ─── Compact HUD (used in Town and Dungeon panel headers) ─────────────────
export function PlayerHud({ player, compact = false }: PlayerHudProps) {
  const hpPct = (player.health / player.maxHealth) * 100;
  const xpPct = player.experienceForNextLevel > 0
    ? (player.experience / player.experienceForNextLevel) * 100
    : 0;
  const biomeName = formatBiomeName(player.biomeId);

  if (compact) {
    return (
      <div
        style={{
          marginBottom: 8,
          padding: '8px 10px',
          border: `1px solid ${colors.border}`,
          background: colors.card,
          fontFamily: FONT_STACK,
        }}
      >
        {/* Name row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 7,
          }}
        >
          <div>
            <strong style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {player.name}
            </strong>
            <span style={{ fontSize: 10, color: colors.muted, marginLeft: 6 }}>
              Lv.{player.level}
            </span>
            {player.floor > 0 && (
              <span style={{ fontSize: 10, color: colors.muted, marginLeft: 6 }}>
                Floor {player.floor}
              </span>
            )}
            {player.biomeId && (
              <span style={{ fontSize: 10, color: player.biomeColor, marginLeft: 6 }}>
                ⬤ {biomeName}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: colors.gold, fontWeight: 600 }}>
            {player.gold}g
          </span>
        </div>

        {/* HP bar */}
        <StatBar
          label="HP"
          fillColor={hpBarColor(player.health, player.maxHealth)}
          pct={hpPct}
          valueLabel={`${player.health} / ${player.maxHealth}`}
        />

        {/* XP bar — only shown when experienceForNextLevel is available */}
        {player.experienceForNextLevel > 0 && (
          <StatBar
            label="XP"
            fillColor={colors.steel}
            pct={xpPct}
            valueLabel={`${player.experience} / ${player.experienceForNextLevel}`}
          />
        )}

        {/* Status effects */}
        {player.statuses && player.statuses.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
            {player.statuses.map(s => (
              <span
                key={s.id}
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  background: s.beneficial ? '#1a4a1a' : '#4a1a1a',
                  color: s.beneficial ? '#4f4' : '#f44',
                  border: `1px solid ${s.beneficial ? '#2a6a2a' : '#6a2a2a'}`,
                }}
              >
                {s.name} ({s.turnsRemaining})
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Full HUD (standalone use) ────────────────────────────────────────────
  return (
    <div
      style={{
        marginBottom: 10,
        padding: '8px 10px',
        border: `1px solid ${colors.border}`,
        background: colors.card,
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 7,
        }}
      >
        <div>
          <strong style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            {player.name}
          </strong>
          <span style={{ fontSize: 10, color: colors.muted, marginLeft: 6 }}>
            Lv.{player.level} · Floor {player.floor}
          </span>
        </div>
        <span style={{ fontSize: 13, color: colors.gold, fontWeight: 600 }}>
          {player.gold}g
        </span>
      </div>

      <StatBar
        label="HP"
        fillColor={hpBarColor(player.health, player.maxHealth)}
        pct={hpPct}
        valueLabel={`${player.health} / ${player.maxHealth}`}
      />

      {player.experienceForNextLevel > 0 && (
        <StatBar
          label="XP"
          fillColor={colors.steel}
          pct={xpPct}
          valueLabel={`${player.experience} / ${player.experienceForNextLevel}`}
        />
      )}

      {/* Secondary stats inline */}
      <div style={{ fontSize: 11, color: colors.muted, marginTop: 5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>ATK <span style={{ color: colors.gold }}>{player.attack}</span></span>
        <span>DEF <span style={{ color: colors.steel }}>{player.defense}</span></span>
        {player.accuracy !== undefined && (
          <span>ACC <span style={{ color: colors.teal }}>{player.accuracy}%</span></span>
        )}
        {player.evasion !== undefined && (
          <span>EVA <span style={{ color: colors.teal }}>{player.evasion}%</span></span>
        )}
        {player.biomeId && (
          <span style={{ color: player.biomeColor }}>⬤ {biomeName}</span>
        )}
      </div>

      {/* Statuses */}
      {player.statuses && player.statuses.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
          {player.statuses.map(s => (
            <span
              key={s.id}
              style={{
                fontSize: 9,
                padding: '1px 5px',
                background: s.beneficial ? '#1a4a1a' : '#4a1a1a',
                color: s.beneficial ? '#4f4' : '#f44',
                border: `1px solid ${s.beneficial ? '#2a6a2a' : '#6a2a2a'}`,
              }}
            >
              {s.name} ({s.turnsRemaining})
            </span>
          ))}
        </div>
      )}

      {/* Abilities */}
      {player.abilities && player.abilities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
          {player.abilities.map(a => (
            <span
              key={a.id}
              title={a.description}
              style={{
                fontSize: 9,
                padding: '1px 5px',
                background: a.ready ? '#1a2a4a' : '#2a2a2a',
                color: a.ready ? colors.steel : '#666',
                border: `1px solid ${a.ready ? '#2a4a7a' : '#444'}`,
              }}
            >
              {a.name}{!a.ready && ` (${a.cooldownRemaining})`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
