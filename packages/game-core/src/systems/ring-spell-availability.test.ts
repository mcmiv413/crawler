/**
 * Test layer: unit
 * Behavior: Ring spell study availability exposes per-school XP gates for combo spells and unlocks study only when school, gold, prerequisite, and XP requirements are met.
 * Proof: Assertions check schoolGates lengths, fire and lightning currentXp/requiredXp/met values, visibleForStudy/unlockedForStudy/canStudy flags, and empty schoolGates for spells without XP requirements.
 * Validation: pnpm vitest run packages/game-core/src/systems/ring-spell-availability.test.ts
 */
import { describe, it, expect } from 'vitest';
import { evaluateRingSpellStudy } from './ring-spell-availability.js';
import { createTestPlayer } from '../test-utils.js';

type StudySpell = Parameters<typeof evaluateRingSpellStudy>[2];
const THUNDERSTORM_LEVEL_FOUR_XP = 140;

function createStudySpell(overrides: Partial<StudySpell> = {}): StudySpell {
  return {
    id: 'stormfire',
    name: 'Test Spell',
    description: 'A test ring spell.',
    cooldown: 0,
    requiresTarget: false,
    unlockLevel: 1,
    xpGainOnCast: 1,
    animation: { id: 'fx.impact.lightning-strike' },
    schools: ['fire'],
    studyRequirements: [],
    effectKind: 'self_buff',
    range: 0,
    ...overrides,
  };
}

const thunderstormLikeSpell = createStudySpell({
  id: 'thunderstorm',
  name: 'Thunderstorm',
  schools: ['fire', 'lightning'],
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'equippedSchool', school: 'lightning' },
    { kind: 'minimumSchoolXp', school: 'fire', xp: THUNDERSTORM_LEVEL_FOUR_XP },
    { kind: 'minimumSchoolXp', school: 'lightning', xp: THUNDERSTORM_LEVEL_FOUR_XP },
    { kind: 'goldCost', gold: 150 },
    { kind: 'prerequisiteSpell', spellId: 'stormfire' },
  ],
});

const stormfireLikeSpell = createStudySpell({
  id: 'stormfire',
  name: 'Stormfire',
  schools: ['fire', 'lightning'],
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'equippedSchool', school: 'lightning' },
    { kind: 'goldCost', gold: 120 },
    { kind: 'prerequisiteSpell', spellId: 'plasma_arc' },
  ],
});

describe('ring-spell-availability', () => {
  it('exposes per-school XP gates for multi-school combo spells', () => {
    const player = createTestPlayer();

    // Set up player with partial XP in both fire and lightning
    const updatedPlayer = {
      ...player,
      ringMastery: {
        fire: { xp: 80, lastLevelCheckpoint: 0 },
        lightning: { xp: 120, lastLevelCheckpoint: 0 },
        ice: { xp: 0, lastLevelCheckpoint: 0 },
      },
      learnedRingSpellIds: ['stormfire'], // Has prerequisite
      gold: 200,
    };

    // Equip both fire and lightning rings
    const equippedItemIds = ['fire_ring', 'lightning_ring'];

    // Evaluate thunderstorm (requires Fire and Lightning display level 4 / 140 XP)
    const evaluation = evaluateRingSpellStudy(updatedPlayer, equippedItemIds, thunderstormLikeSpell);

    // Should have schoolGates for both schools
    expect(evaluation.schoolGates).toBeDefined();
    expect(evaluation.schoolGates).toHaveLength(2);

    // Find fire and lightning gates
    const fireGate = evaluation.schoolGates.find(g => g.school === 'fire');
    const lightningGate = evaluation.schoolGates.find(g => g.school === 'lightning');

    expect(fireGate).toMatchObject({
      currentXp: 80,
      requiredXp: THUNDERSTORM_LEVEL_FOUR_XP,
      met: false,
    });

    expect(lightningGate).toMatchObject({
      currentXp: 120,
      requiredXp: THUNDERSTORM_LEVEL_FOUR_XP,
      met: false,
    });

    // Overall spell should not be unlocked (fire gate not met)
    expect(evaluation.visibleForStudy).toBe(true);
    expect(evaluation.unlockedForStudy).toBe(false);
  });

  it('marks all school gates as met when requirements are satisfied', () => {
    const player = createTestPlayer();

    // Set up player with sufficient XP in both schools
    const updatedPlayer = {
      ...player,
      ringMastery: {
        fire: { xp: 150, lastLevelCheckpoint: 0 },
        lightning: { xp: 150, lastLevelCheckpoint: 0 },
        ice: { xp: 0, lastLevelCheckpoint: 0 },
      },
      learnedRingSpellIds: ['stormfire'],
      gold: 200,
    };

    const equippedItemIds = ['fire_ring', 'lightning_ring'];

    const evaluation = evaluateRingSpellStudy(updatedPlayer, equippedItemIds, thunderstormLikeSpell);

    // All school gates should be met
    expect(evaluation.schoolGates).toHaveLength(2);
    expect(evaluation.schoolGates.every(g => g.met)).toBe(true);

    // Spell should be unlocked for study
    expect(evaluation.unlockedForStudy).toBe(true);
    expect(evaluation.canStudy).toBe(true);
  });

  it('returns empty schoolGates for spells without XP requirements', () => {
    const player = createTestPlayer();

    const updatedPlayer = {
      ...player,
      ringMastery: {
        fire: { xp: 30, lastLevelCheckpoint: 0 },
        lightning: { xp: 0, lastLevelCheckpoint: 0 },
        ice: { xp: 0, lastLevelCheckpoint: 0 },
      },
      learnedRingSpellIds: ['plasma_arc'],
      gold: 150,
    };

    const equippedItemIds = ['fire_ring', 'lightning_ring'];

    // Evaluate stormfire (no XP requirements, only equippedSchool and prerequisite)
    const evaluation = evaluateRingSpellStudy(updatedPlayer, equippedItemIds, stormfireLikeSpell);

    // Should have no school gates (no XP requirements)
    expect(evaluation.schoolGates).toHaveLength(0);

    // Spell should be unlocked since prerequisites are met
    expect(evaluation.unlockedForStudy).toBe(true);
  });
});
