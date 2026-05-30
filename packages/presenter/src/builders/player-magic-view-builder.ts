import type { GameState } from '@dungeon/contracts';
import { RING_SPELL_BY_ID, getRingSchools } from '@dungeon/content';
import {
  evaluateAllRingSpellStudy,
  getEquippedRingItemIds,
  getMagicLevel,
  getNextMagicLevelXp,
  getNextSchoolDisplayLevelXp,
  getSchoolDisplayLevelFromXp,
  getTotalMagicXp,
} from '@dungeon/core';
import type {
  LearnedSpellView,
  RingSchoolMasteryView,
  RingSpellView,
} from '../game-view.js';

export interface RingMagicSection {
  readonly hasRingMagic: boolean;
  readonly totalMagicXp: number;
  readonly magicLevel: number;
  readonly nextMagicLevelXp: number | null;
  readonly ringSchoolMasteries: readonly RingSchoolMasteryView[];
  readonly learnedSpells: readonly LearnedSpellView[];
  readonly studyableSpells: readonly RingSpellView[];
}

function collectDiscoveredSchoolIds(
  state: GameState,
  equippedItemIds: readonly string[],
  learnedSpellIds: readonly string[],
): Set<string> {
  const discoveredSchoolIds = new Set<string>();
  const ringSchools = getRingSchools();

  for (const school of ringSchools) {
    if (state.player.ringMastery[school.id] !== undefined) {
      discoveredSchoolIds.add(school.id);
    }
  }

  for (const itemId of equippedItemIds) {
    const school = ringSchools.find(candidate => candidate.ringId === itemId);
    if (school !== undefined) {
      discoveredSchoolIds.add(school.id);
    }
  }

  for (const spellId of learnedSpellIds) {
    const spell = RING_SPELL_BY_ID.get(spellId);
    if (spell === undefined) {
      continue;
    }

    for (const schoolId of spell.schools) {
      discoveredSchoolIds.add(schoolId);
    }
  }

  return discoveredSchoolIds;
}

function buildRingSchoolMasteries(
  state: GameState,
  discoveredSchoolIds: ReadonlySet<string>,
): RingSchoolMasteryView[] {
  return getRingSchools()
    .filter(school => discoveredSchoolIds.has(school.id))
    .map(school => {
      const currentXp = state.player.ringMastery[school.id]?.xp ?? 0;
      return {
        school: school.id,
        xp: currentXp,
        displayLevel: getSchoolDisplayLevelFromXp(currentXp),
        nextDisplayLevelXp: getNextSchoolDisplayLevelXp(currentXp),
      };
    });
}

function buildLearnedSpellViews(learnedSpellIds: readonly string[]): LearnedSpellView[] {
  return learnedSpellIds.flatMap(spellId => {
    const spell = RING_SPELL_BY_ID.get(spellId);
    return spell === undefined
      ? []
      : [{
          spellId: spell.id,
          name: spell.name,
          description: spell.description,
          schools: spell.schools,
          cooldown: spell.cooldown,
          manaCost: spell.manaCost ?? 0,
          xpGainOnCast: spell.xpGainOnCast,
          learned: true,
          unlocked: true,
        }];
  });
}

function buildStudyableSpellViews(
  state: GameState,
  equippedItemIds: readonly string[],
): RingSpellView[] {
  return evaluateAllRingSpellStudy(state.player, equippedItemIds)
    .filter(result => result.unlockedForStudy)
    .map(result => ({
      spellId: result.spell.id,
      name: result.spell.name,
      description: result.spell.description,
      schools: result.spell.schools,
      cooldown: result.spell.cooldown,
      manaCost: result.spell.manaCost ?? 0,
      xpGainOnCast: result.spell.xpGainOnCast,
      baseDamage: result.spell.baseDamage ?? 0,
      range: result.spell.range,
      unlockLevel: result.requiredSchoolXp,
      learned: result.alreadyLearned,
      unlocked: result.unlockedForStudy,
      affordable: result.affordable,
      canStudy: result.canStudy,
      requiredSchoolXp: result.requiredSchoolXp,
      goldCost: result.goldCost,
      currentSchoolXp: result.currentSchoolXp,
    }));
}

export function buildRingMagicSection(state: GameState): RingMagicSection {
  const equippedItemIds = getEquippedRingItemIds(
    state.player.equipment,
    state.itemRegistry.items,
  );
  const learnedSpellIds = state.player.learnedRingSpellIds ?? [];
  const totalMagicXp = getTotalMagicXp(state.player);
  const ringSchoolMasteries = buildRingSchoolMasteries(
    state,
    collectDiscoveredSchoolIds(state, equippedItemIds, learnedSpellIds),
  );

  return {
    hasRingMagic: ringSchoolMasteries.length > 0 || learnedSpellIds.length > 0,
    totalMagicXp,
    magicLevel: getMagicLevel(state.player),
    nextMagicLevelXp: getNextMagicLevelXp(totalMagicXp),
    ringSchoolMasteries,
    learnedSpells: buildLearnedSpellViews(learnedSpellIds),
    studyableSpells: buildStudyableSpellViews(state, equippedItemIds),
  };
}
