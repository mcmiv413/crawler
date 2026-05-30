import { describe, it, expect } from 'vitest';
import { createTestPlayer } from '../test-utils.js';
import {
  canFireMasteryPanicOnSpread,
  canFireMasteryRestoreManaOnBurnKill,
  gainSchoolXp,
  getFireBurnDuration,
  getFireBurnMagnitude,
  getFireBurnSpreadRadius,
  getFireMasteryLevel,
  getMagicLevel,
  getNextMagicLevelXp,
  getTotalMagicXp,
  learnRingSpell,
} from './magic-xp.js';

const LEVEL_TWO_MAGIC_XP = 60;
const LEVEL_THREE_MAGIC_XP = 150;
const LEVEL_TWO_MAX_MANA = 25;
const LEVEL_TWO = 2;

describe('magic-xp', () => {
  it('tracks Fire XP without discarding learned spells', () => {
    const spellId = 'heat_surge';
    const player = createTestPlayer({
      learnedRingSpellIds: [spellId],
      ringMastery: {
        fire: {
          xp: 0,
        },
      },
    });

    const updated = gainSchoolXp(player, 'fire', player.maxMana);

    expect(updated.ringMastery.fire?.xp).toBeGreaterThan(player.ringMastery.fire?.xp ?? 0);
    expect(updated.learnedRingSpellIds).toContain(spellId);
  });

  it('increases max mana when total magic XP crosses a global magic-level threshold', () => {
    const player = createTestPlayer({
      ringMastery: {
        fire: { xp: LEVEL_TWO_MAGIC_XP - 5 },
        ice: { xp: 4 },
      },
    });

    const updated = gainSchoolXp(player, 'ice', 1);

    expect(getTotalMagicXp(updated)).toBe(LEVEL_TWO_MAGIC_XP);
    expect(getMagicLevel(updated)).toBe(LEVEL_TWO);
    expect(getNextMagicLevelXp(getTotalMagicXp(updated))).toBe(LEVEL_THREE_MAGIC_XP);
    expect(updated.maxMana).toBe(LEVEL_TWO_MAX_MANA);
  });

  it('scales burn duration, burn magnitude, and spread radius with Fire mastery', () => {
    const player = createTestPlayer();
    const mastered = gainSchoolXp(player, 'fire', player.maxMana * player.maxMana * player.maxMana);
    const baseDuration = 2;

    expect(getFireBurnDuration(mastered, baseDuration)).toBeGreaterThan(getFireBurnDuration(player, baseDuration));
    expect(getFireBurnMagnitude(mastered)).toBeGreaterThan(getFireBurnMagnitude(player));
    expect(getFireBurnSpreadRadius(mastered)).toBeGreaterThan(getFireBurnSpreadRadius(player));
  });

  it('unlocks high-mastery burn spread panic and burn-kill mana restoration gates', () => {
    const player = createTestPlayer();
    const mastered = gainSchoolXp(player, 'fire', LEVEL_TWO_MAGIC_XP);

    expect(canFireMasteryPanicOnSpread(mastered)).toBe(true);
    expect(canFireMasteryRestoreManaOnBurnKill(mastered)).toBe(true);
  });

  it('learns each Fire spell only once', () => {
    const spellId = 'heat_surge';
    const player = createTestPlayer();

    const learned = learnRingSpell(player, spellId);
    const duplicate = learnRingSpell(learned, spellId);

    expect(learned.learnedRingSpellIds).toContain(spellId);
    expect(duplicate).toBe(learned);
  });
});
