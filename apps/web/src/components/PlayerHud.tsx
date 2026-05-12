import { useEffect } from 'react';
import type { PlayerHudView } from '@dungeon/presenter';
import { colors, hpBarColor, FONT_STACK, injectHpPulse } from '../styles.js';
import { STAT_BAR_HEIGHT, HUD_VALUE_FONT_SIZE } from '../config/ui-config.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';

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
  pulse = false,
  layout = 'inline',
  testId,
}: {
  label: string;
  fillColor: string;
  pct: number;
  valueLabel: string;
  pulse?: boolean;
  layout?: 'inline' | 'compact-inline';
  testId?: string;
}) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const barStyle = {
    flex: 1,
    height: STAT_BAR_HEIGHT,
    background: colors.inset,
    border: `1px solid ${colors.border2}`,
    overflow: 'hidden',
  };

  if (layout === 'compact-inline') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span
            style={{
              fontSize: 9,
              color: colors.label,
              width: 18,
              flexShrink: 0,
              letterSpacing: '0.04em',
            }}
          >
            {label}
          </span>
          <div
            data-testid={testId ? `${testId}-track` : undefined}
            style={{
              ...barStyle,
              height: STAT_BAR_HEIGHT + 5,
              background: colors.panel,
              borderColor: pulse ? colors.blood : colors.border2,
              boxShadow: pulse ? '0 0 0 1px rgba(200, 90, 74, 0.5), 0 0 8px rgba(200, 90, 74, 0.24)' : 'none',
            }}
          >
            <div
              data-testid={testId ? `${testId}-fill` : undefined}
              style={{
                width: `${clampedPct}%`,
                height: '100%',
                background: fillColor,
                transition: 'width 0.3s ease',
                animation: pulse ? 'hpPulse 1.2s ease-in-out infinite' : 'none',
              }}
            />
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            color: colors.text,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {valueLabel}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 10, color: colors.label, width: 20, flexShrink: 0 }}>
        {label}
      </span>
      <div
        style={barStyle}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            height: '100%',
            background: fillColor,
            transition: 'width 0.3s ease',
            animation: pulse ? 'hpPulse 1.2s ease-in-out infinite' : 'none',
          }}
        />
      </div>
      <span style={{ fontSize: HUD_VALUE_FONT_SIZE, color: colors.text, width: 50, textAlign: 'right', flexShrink: 0 }}>
        {valueLabel}
      </span>
    </div>
  );
}

// ─── Compact HUD (used in Town and Dungeon panel headers) ─────────────────
export function PlayerHud({ player, compact = false }: PlayerHudProps) {
  const { isMobile } = useBreakpoint();
  const hpPct = (player.health / player.maxHealth) * 100;
  const mana = player.mana ?? 0;
  const maxMana = player.maxMana ?? 0;
  const hasMana = maxMana > 0;
  const mpPct = hasMana ? (mana / maxMana) * 100 : 0;
  const xpPct = player.experienceForNextLevel > 0
    ? (player.experience / player.experienceForNextLevel) * 100
    : 0;
  const biomeName = formatBiomeName(player.biomeId);
  const hpLow = hpPct <= 30;
  const useDenseCompactBars = compact && isMobile && (player.experienceForNextLevel > 0 || hasMana);

  // Inject @keyframes hpPulse once on first mount
  useEffect(() => { injectHpPulse(); }, []);

  if (compact) {
    return (
      <div
        style={{
          marginBottom: isMobile ? 6 : 8,
          padding: isMobile ? '6px 8px' : '8px 10px',
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
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: useDenseCompactBars ? 6 : 7,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 6px', minWidth: 0 }}>
            <strong style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: colors.text }}>
              {player.name}
            </strong>
            <span style={{ fontSize: 10, color: colors.muted }}>
              Lv.{player.level}
            </span>
            {player.floor > 0 && (
              <span style={{ fontSize: 10, color: colors.muted }}>
                F.{player.floor}
              </span>
            )}
            {player.biomeId && (
              <span style={{ fontSize: 10, color: player.biomeColor }}>
                {biomeName}
              </span>
            )}
          </div>
          <span style={{ fontSize: isMobile ? 11 : 12, color: colors.gold, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {player.gold}g
          </span>
        </div>

        <div
          data-testid="compact-player-hud-bars"
          style={{
            display: 'grid',
            gridTemplateColumns: hasMana ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
            gap: 4,
          }}
        >
          <StatBar
            label="HP"
            fillColor={hpBarColor(player.health, player.maxHealth)}
            pct={hpPct}
            valueLabel={`${player.health}/${player.maxHealth}`}
            pulse={hpLow}
            layout="compact-inline"
            testId="compact-hp-bar"
          />

          {hasMana && (
            <StatBar
              label="MP"
              fillColor="#4aa3ff"
              pct={mpPct}
              valueLabel={`${mana}/${maxMana}`}
              layout="compact-inline"
              testId="compact-mp-bar"
            />
          )}

          {player.experienceForNextLevel > 0 && (
            <StatBar
              label="XP"
              fillColor={colors.steel}
              pct={xpPct}
              valueLabel={`${player.experience}/${player.experienceForNextLevel}`}
              layout="compact-inline"
              testId="compact-xp-bar"
            />
          )}
        </div>

        {/* Status effects */}
        {player.statuses && player.statuses.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: useDenseCompactBars ? 5 : 4 }}>
            {player.statuses.map(s => (
              <span
                key={s.id}
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  background: s.beneficial ? '#1a4a1a' : '#3a1414',
                  color: s.beneficial ? colors.lime : colors.blood,
                  border: `1px solid ${s.beneficial ? '#2a6a2a' : '#5a2020'}`,
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
          <strong style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
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
        pulse={hpLow}
      />

      {hasMana && (
        <StatBar
          label="MP"
          fillColor="#4aa3ff"
          pct={mpPct}
          valueLabel={`${mana} / ${maxMana}`}
          testId="mp-bar"
        />
      )}

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
        <span>ATK <span style={{ color: colors.gold }}>{player.statBreakdowns.attack?.base ?? player.attack}</span></span>
        <span>DEF <span style={{ color: colors.steel }}>{player.statBreakdowns.defense?.base ?? player.defense}</span></span>
        {player.accuracy !== undefined && (
          <span>ACC <span style={{ color: colors.teal }}>{player.accuracy}%</span></span>
        )}
        {player.evasion !== undefined && (
          <span>EVA <span style={{ color: colors.teal }}>{player.evasion}%</span></span>
        )}
        {player.biomeId && (
          <span style={{ color: player.biomeColor }}>{biomeName}</span>
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
                background: s.beneficial ? '#1a4a1a' : '#3a1414',
                color: s.beneficial ? colors.lime : colors.blood,
                border: `1px solid ${s.beneficial ? '#2a6a2a' : '#5a2020'}`,
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
                background: a.ready ? '#0e1e2e' : '#1a1a22',
                color: a.ready ? colors.steel : colors.muted,
                border: `1px solid ${a.ready ? '#2a4a6a' : colors.border2}`,
              }}
            >
              {a.name}{a.manaCost !== undefined ? ` ${a.manaCost}MP` : ''}{!a.ready && a.cooldownRemaining > 0 && ` (${a.cooldownRemaining})`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
