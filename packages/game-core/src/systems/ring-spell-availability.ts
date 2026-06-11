import { RING_SPELL_BY_ID } from '@dungeon/content';
import { getSchoolForRing } from '@dungeon/content';
import type { Player, Equipment, EntityId, AnyItemTemplate } from '@dungeon/contracts';
import type { RingSchool, SpellStudyRequirement, RingSpellDefinition } from '@dungeon/content';
import {
  getSchoolDisplayLevelFromXp,
  getSchoolDisplayLevelXpThreshold,
} from './magic-xp.js';

function getSchoolDisplayLevel(player: Player, school: RingSchool): number {
  const xp = (player.ringMastery as Record<string, { xp: number }>)[school]?.xp ?? 0;
  return getSchoolDisplayLevelFromXp(xp);
}

// Evaluate all study requirements against runtime player state
function meetsStudyRequirement(
  req: SpellStudyRequirement,
  player: Player,
  equippedSchools: Set<RingSchool>,
): boolean {
  switch (req.kind) {
    case 'equippedSchool':
      return equippedSchools.has(req.school);
    case 'minimumSchoolXp':
      return ((player.ringMastery as Record<string, { xp: number }>)[req.school]?.xp ?? 0) >= req.xp;
    case 'goldCost':
      return player.gold >= req.gold;
    case 'prerequisiteSpell':
      return player.learnedRingSpellIds.includes(req.spellId);
  }
}

function getEquippedRingSchools(
  equippedItemIds: readonly string[],
): Set<RingSchool> {
  return new Set(
    equippedItemIds
      .map(itemId => getSchoolForRing(itemId))
      .filter((school): school is RingSchool => school !== undefined),
  );
}

function meetsNonGoldStudyRequirements(
  requirements: readonly StudyRequirementStatus[],
): boolean {
  return requirements.every(requirement => requirement.kind === 'goldCost' || requirement.met === true);
}

function meetsStudyVisibilityRequirements(
  requirements: readonly StudyRequirementStatus[],
): boolean {
  return requirements.every(requirement =>
    requirement.kind === 'goldCost'
    || requirement.kind === 'minimumSchoolXp'
    || requirement.met === true
  );
}

// Extract equipped item IDs from equipment + registry
export function getEquippedRingItemIds(
  equipment: Equipment,
  registry: ReadonlyMap<EntityId, AnyItemTemplate>,
): readonly string[] {
  const slots: readonly (keyof Equipment)[] = ['weapon', 'secondaryWeapon', 'chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'] as const;
  return slots
    .map(slot => {
      const itemEntityId = equipment[slot];
      if (itemEntityId === null) return undefined;
      const template = registry.get(itemEntityId);
      return template?.itemId;
    })
    .filter((id): id is string => id !== undefined);
}

// Full spell study evaluation with per-requirement breakdown
export interface StudyRequirementStatus {
  readonly kind: SpellStudyRequirement['kind'];
  readonly met: boolean;
}

export interface SchoolProgressGate {
  readonly school: RingSchool;
  readonly currentXp: number;
  readonly requiredXp: number;
  readonly met: boolean;
}

export interface SpellStudyEvaluation {
  readonly spell: RingSpellDefinition;
  readonly alreadyLearned: boolean;
  readonly requirements: readonly StudyRequirementStatus[];
  readonly visibleForStudy: boolean;
  readonly unlockedForStudy: boolean;
  readonly canStudy: boolean;
  readonly affordable: boolean;
  readonly schoolGates: readonly SchoolProgressGate[];
  readonly goldCost: number;
}

export function evaluateRingSpellStudy(
  player: Player,
  equippedItemIds: readonly string[],
  spell: RingSpellDefinition,
): SpellStudyEvaluation {
  const equippedSchools = getEquippedRingSchools(equippedItemIds);
  const alreadyLearned = player.learnedRingSpellIds.includes(spell.id);

  let goldCost = 0;
  const requirements = spell.studyRequirements.map(req => {
    const met = meetsStudyRequirement(req, player, equippedSchools);
    if (req.kind === 'goldCost') {
      goldCost = req.gold;
    }
    return { kind: req.kind, met };
  });

  const xpRequirements = spell.studyRequirements.filter(
    (req): req is Extract<SpellStudyRequirement, { kind: 'minimumSchoolXp' }> =>
      req.kind === 'minimumSchoolXp'
  );
  const explicitXpRequirementSchools = new Set(xpRequirements.map(req => req.school));
  const implicitDisplayLevelRequirements = spell.minimumSchoolLevel === undefined
    ? []
    : spell.schools
        .filter(school => !explicitXpRequirementSchools.has(school))
        .map(school => ({
          school,
          xp: getSchoolDisplayLevelXpThreshold(spell.minimumSchoolLevel!),
        }));

  const schoolGates = [...xpRequirements, ...implicitDisplayLevelRequirements].map((req) => {
    const currentXp = (player.ringMastery as Record<string, { xp: number }>)[req.school]?.xp ?? 0;
    return {
      school: req.school,
      currentXp,
      requiredXp: req.xp,
      met: currentXp >= req.xp,
    };
  });

  // Check if player meets minimum school level requirement
  const meetsMinimumLevel = spell.minimumSchoolLevel === undefined
    || spell.schools.some(school => 
        getSchoolDisplayLevel(player, school) >= spell.minimumSchoolLevel!
      );
  const meetsSchoolGates = schoolGates.every(gate => gate.met);

  const visibleForStudy = meetsMinimumLevel && meetsStudyVisibilityRequirements(requirements) && !alreadyLearned;
  const unlockedForStudy = meetsMinimumLevel && meetsSchoolGates && meetsNonGoldStudyRequirements(requirements) && !alreadyLearned;
  const affordable = goldCost === 0 || player.gold >= goldCost;
  const canStudy = unlockedForStudy && affordable;

  return {
    spell,
    alreadyLearned,
    requirements,
    visibleForStudy,
    unlockedForStudy,
    canStudy,
    affordable,
    schoolGates,
    goldCost,
  };
}

export function evaluateAllRingSpellStudy(
  player: Player,
  equippedItemIds: readonly string[],
): readonly SpellStudyEvaluation[] {
  return [...RING_SPELL_BY_ID.values()].map(spell =>
    evaluateRingSpellStudy(player, equippedItemIds, spell)
  );
}

// Check if a learned spell can be cast with current equipped rings
// This checks ONLY learned status and required school rings.
// Execution also checks: mana, cooldown, targeting validity, silence/stun, combat context.
export function canUseLearnedRingSpell(
  player: Player,
  spellId: string,
  equippedItemIds: readonly string[],
): boolean {
  if (!player.learnedRingSpellIds.includes(spellId)) return false;
  const spell = RING_SPELL_BY_ID.get(spellId);
  if (spell === undefined) return false;

  const equippedSchools = getEquippedRingSchools(equippedItemIds);
  return spell.schools.every((s: RingSchool) => equippedSchools.has(s));
}
