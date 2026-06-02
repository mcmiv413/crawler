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
  getNextSchoolDisplayLevelXp,
  getNextSchoolMasteryXp,
  getSchoolDisplayLevelFromXp,
  getSchoolMasteryLevelFromXp,
  getTotalMagicXp,
  learnRingSpell,
} from './magic-xp.js';

const LEVEL_TWO_MAGIC_XP = 60;
const LEVEL_THREE_MAGIC_XP = 150;
const LEVEL_TWO_MAX_MANA = 25;
const LEVEL_TWO = 2;
const LEVEL_THREE = LEVEL_TWO + 1;
const POST_CAP_DISPLAY_LEVEL_XP = 140;

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

  it('applies a multi-school spell cast XP gain to every listed school', () => {
    const thunderstormCast = {
      schools: ['fire', 'lightning'] as const,
      xpGainOnCast: 3,
    };
    const player = createTestPlayer({
      ringMastery: {
        fire: { xp: 10 },
        lightning: { xp: 20 },
      },
    });

    const updated = thunderstormCast.schools.reduce(
      (currentPlayer, school) => gainSchoolXp(currentPlayer, school, thunderstormCast.xpGainOnCast),
      player,
    );

    expect(updated.ringMastery.fire?.xp).toBe((player.ringMastery.fire?.xp ?? 0) + thunderstormCast.xpGainOnCast);
    expect(updated.ringMastery.lightning?.xp).toBe(
      (player.ringMastery.lightning?.xp ?? 0) + thunderstormCast.xpGainOnCast,
    );
    expect(getTotalMagicXp(updated) - getTotalMagicXp(player)).toBe(
      thunderstormCast.schools.length * thunderstormCast.xpGainOnCast,
    );
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

  it('keeps mastery benefits capped while display level continues growing after the authored cap', () => {
    const player = createTestPlayer();
    const capped = gainSchoolXp(player, 'fire', LEVEL_TWO_MAGIC_XP);
    const postCap = gainSchoolXp(player, 'fire', LEVEL_TWO_MAGIC_XP + 40);

    expect(getSchoolMasteryLevelFromXp(capped.ringMastery.fire?.xp ?? 0)).toBe(LEVEL_TWO);
    expect(getSchoolMasteryLevelFromXp(postCap.ringMastery.fire?.xp ?? 0)).toBe(LEVEL_TWO);
    expect(getNextSchoolMasteryXp(postCap.ringMastery.fire?.xp ?? 0)).toBeNull();

    expect(getSchoolDisplayLevelFromXp(capped.ringMastery.fire?.xp ?? 0)).toBe(LEVEL_TWO);
    expect(getSchoolDisplayLevelFromXp(postCap.ringMastery.fire?.xp ?? 0)).toBe(LEVEL_THREE);
    expect(getNextSchoolDisplayLevelXp(postCap.ringMastery.fire?.xp ?? 0)).toBe(POST_CAP_DISPLAY_LEVEL_XP);

    expect(getFireMasteryLevel(postCap)).toBe(getFireMasteryLevel(capped));
    expect(getFireBurnDuration(postCap, 2)).toBe(getFireBurnDuration(capped, 2));
    expect(getFireBurnMagnitude(postCap)).toBe(getFireBurnMagnitude(capped));
    expect(getFireBurnSpreadRadius(postCap)).toBe(getFireBurnSpreadRadius(capped));
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
