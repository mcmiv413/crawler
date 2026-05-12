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
  learnRingSpell,
} from './magic-xp.js';

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

  it('increases max mana when Fire XP crosses a mastery threshold', () => {
    const player = createTestPlayer();
    const largeFireXpGain = player.maxMana * player.maxMana * player.maxMana;

    const updated = gainSchoolXp(player, 'fire', largeFireXpGain);

    expect(getFireMasteryLevel(updated)).toBeGreaterThan(getFireMasteryLevel(player));
    expect(updated.maxMana).toBeGreaterThan(player.maxMana);
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
    const mastered = gainSchoolXp(player, 'fire', player.maxMana * player.maxMana * player.maxMana);

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
