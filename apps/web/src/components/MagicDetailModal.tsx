import React, { useMemo, useState } from 'react';
import type { LearnedSpellView, PlayerHudView } from '@dungeon/presenter';
import { colors, FONT_STACK, btnStyle } from '../styles.js';
import { ModalBackdrop, ModalCard, SectionLabel } from './ui/index.js';

interface MagicDetailModalProps {
  player: PlayerHudView;
  onClose: () => void;
}

function titleCase(text: string): string {
  return text.replace(/\b\w/g, char => char.toUpperCase());
}

function buildSpellMeta(spell: LearnedSpellView): string {
  const parts = [`${spell.manaCost} MP`, `+${spell.xpGainOnCast} XP/cast`];
  if (spell.cooldown > 0) {
    parts.push(`CD ${spell.cooldown}`);
  }

  return parts.join(' · ');
}

export function MagicDetailModal({ player, onClose }: MagicDetailModalProps) {
  const schoolEntries = useMemo(() => (
    player.ringSchoolMasteries.map(mastery => ({
      mastery,
      spells: player.learnedSpells.filter(spell => spell.schools.includes(mastery.school)),
    }))
  ), [player.learnedSpells, player.ringSchoolMasteries]);

  const [selectedSchool, setSelectedSchool] = useState<string>(schoolEntries[0]?.mastery.school ?? '');

  if (schoolEntries.length === 0) {
    return null;
  }

  const selectedEntry = schoolEntries.find(entry => entry.mastery.school === selectedSchool) ?? schoolEntries[0]!;
  const nextMagicLevelXp = player.magicExperienceForNextLevel;
  const magicProgressLabel = nextMagicLevelXp === null
    ? `Magic Lv ${player.magicLevel ?? 1} · Maxed`
    : `${player.magicExperience ?? 0} / ${nextMagicLevelXp} XP toward Magic Lv ${(player.magicLevel ?? 1) + 1}`;

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="MAGIC" accentColor={colors.purple} maxWidth={760}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(170px, 220px) 1fr',
            gap: 16,
            minHeight: 340,
            fontFamily: FONT_STACK,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel label="Schools" />
            {schoolEntries.map(({ mastery }) => {
              const selected = mastery.school === selectedEntry.mastery.school;
              return (
                <button
                  key={mastery.school}
                  onClick={() => setSelectedSchool(mastery.school)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: `1px solid ${selected ? colors.purple : colors.border2}`,
                    background: selected ? '#261b3d' : colors.panel,
                    color: selected ? '#e6dcff' : colors.text,
                    cursor: 'pointer',
                    fontFamily: FONT_STACK,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{titleCase(mastery.school)}</div>
                  <div style={{ fontSize: 11, color: colors.muted }}>
                    Lv {mastery.displayLevel} · {mastery.xp} / {mastery.nextDisplayLevelXp} XP
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                border: `1px solid ${colors.border2}`,
                background: colors.inset,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e6dcff', marginBottom: 6 }}>
                {titleCase(selectedEntry.mastery.school)} Magic
              </div>
              <div style={{ fontSize: 12, color: colors.text, marginBottom: 4 }}>
                Lv {selectedEntry.mastery.displayLevel} · {selectedEntry.mastery.xp} / {selectedEntry.mastery.nextDisplayLevelXp} XP
              </div>
              <div style={{ fontSize: 11, color: '#b0a3d1', marginBottom: 4 }}>{magicProgressLabel}</div>
              <div style={{ fontSize: 11, color: colors.gold }}>Spell Power: {player.spellPower ?? 1}</div>
            </div>

            <div>
              <SectionLabel label="Learned Spells" />
              {selectedEntry.spells.length === 0 ? (
                <div style={{ fontSize: 12, color: colors.muted }}>
                  No learned spells in this school yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedEntry.spells.map(spell => (
                    <div
                      key={`${selectedEntry.mastery.school}:${spell.spellId}`}
                      style={{
                        border: `1px solid ${colors.border2}`,
                        background: colors.panel,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: colors.text, marginBottom: 2 }}>{spell.name}</div>
                      <div style={{ fontSize: 11, color: '#8cf', marginBottom: 4 }}>
                        {buildSpellMeta(spell)}
                      </div>
                      <div style={{ fontSize: 12, color: colors.muted }}>{spell.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ ...btnStyle, marginTop: 16, padding: '6px 12px', fontSize: 11 }}
        >
          Close
        </button>
      </ModalCard>
    </ModalBackdrop>
  );
}
