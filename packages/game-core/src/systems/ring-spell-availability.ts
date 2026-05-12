import { RING_SPELL_BY_ID } from '@dungeon/content';
import { getSchoolForRing } from '@dungeon/content';
import type { Player, Equipment, EntityId, AnyItemTemplate } from '@dungeon/contracts';
import type { RingSchool, SpellStudyRequirement, RingSpellDefinition } from '@dungeon/content';

// Derive school mastery level from XP (not stored)
export function getSchoolMasteryLevel(player: Player, school: RingSchool): number {
  const xp = (player.ringMastery as Record<string, { xp: number }>)[school]?.xp ?? 0;
  // Level thresholds: level 0 at 0 XP, level 1 at 20 XP, level 2 at 60 XP
  if (xp >= 60) return 2;
  if (xp >= 20) return 1;
  return 0;
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

// Spells the player can study right now (meets all requirements including gold)
export function getStudyableRingSpells(
  player: Player,
  equippedItemIds: readonly string[],
): readonly RingSpellDefinition[] {
  const equippedSchools = new Set(
    equippedItemIds
      .map(itemId => getSchoolForRing(itemId))
      .filter(Boolean) as RingSchool[]
  );
  const learned = new Set(player.learnedRingSpellIds);
  return [...RING_SPELL_BY_ID.values()].filter(spell => {
    if (learned.has(spell.id)) return false;
    return spell.studyRequirements.every((req: SpellStudyRequirement) => meetsStudyRequirement(req, player, equippedSchools));
  });
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

export interface SpellStudyEvaluation {
  readonly spell: RingSpellDefinition;
  readonly alreadyLearned: boolean;
  readonly requirements: readonly StudyRequirementStatus[];
  readonly canStudy: boolean;
  readonly affordable: boolean;
  readonly currentSchoolXp: number;
  readonly requiredSchoolXp: number;
  readonly goldCost: number;
}

export function evaluateRingSpellStudy(
  player: Player,
  equippedItemIds: readonly string[],
  spell: RingSpellDefinition,
): SpellStudyEvaluation {
  const equippedSchools = new Set(
    equippedItemIds
      .map(itemId => getSchoolForRing(itemId))
      .filter((s): s is RingSchool => s !== undefined)
  );
  const alreadyLearned = player.learnedRingSpellIds.includes(spell.id);
  
  let goldCost = 0;
  let requiredSchoolXp = 0;
  const requirements = spell.studyRequirements.map(req => {
    const met = meetsStudyRequirement(req, player, equippedSchools);
    if (req.kind === 'goldCost') {
      goldCost = req.gold;
    } else if (req.kind === 'minimumSchoolXp') {
      requiredSchoolXp = req.xp;
    }
    return { kind: req.kind, met };
  });
  
  const allRequirementsMet = requirements.every(r => r.met === true);
  const canStudy = allRequirementsMet && !alreadyLearned;
  const affordable = goldCost === 0 || player.gold >= goldCost;
  
  const primarySchool = spell.schools[0];
  const currentSchoolXp = primarySchool !== undefined ? ((player.ringMastery as Record<string, { xp: number }>)[primarySchool]?.xp ?? 0) : 0;
  
  return {
    spell,
    alreadyLearned,
    requirements,
    canStudy,
    affordable,
    currentSchoolXp,
    requiredSchoolXp,
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

  const equippedSchools = new Set(
    equippedItemIds
      .map(itemId => getSchoolForRing(itemId))
      .filter(Boolean) as RingSchool[]
  );
  return spell.schools.every((s: RingSchool) => equippedSchools.has(s));
}
