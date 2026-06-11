import type { Player } from '@dungeon/contracts';
import { MAGIC } from '@dungeon/content';
import type { RingSchool } from '@dungeon/content';

function getConfiguredLevel(
  xp: number,
  thresholds: readonly number[],
  baseLevel: number,
): number {
  let level = baseLevel;

  while (level + 1 < thresholds.length && xp >= thresholds[level + 1]!) {
    level += 1;
  }

  return level;
}

export function getTotalMagicXp(player: Player): number {
  return Object.values(player.ringMastery).reduce((total, mastery) => total + mastery.xp, 0);
}

export function getMagicLevelFromXp(totalMagicXp: number): number {
  return getConfiguredLevel(totalMagicXp, MAGIC.levelXpTable, 1);
}

export function getMagicLevel(player: Player): number {
  return getMagicLevelFromXp(getTotalMagicXp(player));
}

export function getNextMagicLevelXp(totalMagicXp: number): number | null {
  const magicLevel = getMagicLevelFromXp(totalMagicXp);
  return magicLevel + 1 < MAGIC.levelXpTable.length ? MAGIC.levelXpTable[magicLevel + 1]! : null;
}

export function getSchoolMasteryLevelFromXp(xp: number): number {
  return getConfiguredLevel(xp, MAGIC.schoolMasteryTierThresholds, 0);
}

export function getNextSchoolMasteryXp(xp: number): number | null {
  const masteryLevel = getSchoolMasteryLevelFromXp(xp);
  return masteryLevel + 1 < MAGIC.schoolMasteryTierThresholds.length
    ? MAGIC.schoolMasteryTierThresholds[masteryLevel + 1]!
    : null;
}

export function getSchoolDisplayLevelFromXp(xp: number): number {
  const masteryLevel = getSchoolMasteryLevelFromXp(xp);
  const maxConfiguredXp = MAGIC.schoolMasteryTierThresholds[MAGIC.schoolMasteryTierThresholds.length - 1] ?? 0;

  if (xp < maxConfiguredXp) {
    return masteryLevel;
  }

  return masteryLevel + Math.floor((xp - maxConfiguredXp) / MAGIC.schoolDisplayLevelXpAfterCap);
}

export function getSchoolDisplayLevelXpThreshold(displayLevel: number): number {
  if (displayLevel < MAGIC.schoolMasteryTierThresholds.length) {
    return MAGIC.schoolMasteryTierThresholds[Math.max(0, displayLevel)] ?? 0;
  }

  const maxConfiguredLevel = MAGIC.schoolMasteryTierThresholds.length - 1;
  const maxConfiguredXp = MAGIC.schoolMasteryTierThresholds[maxConfiguredLevel] ?? 0;
  return maxConfiguredXp + ((displayLevel - maxConfiguredLevel) * MAGIC.schoolDisplayLevelXpAfterCap);
}

export function getNextSchoolDisplayLevelXp(xp: number): number {
  return getSchoolDisplayLevelXpThreshold(getSchoolDisplayLevelFromXp(xp) + 1);
}

export function getMaxManaForMagicLevel(magicLevel: number): number {
  return MAGIC.initialMana + Math.max(0, magicLevel - 1) * MAGIC.manaPerMagicLevel;
}

export function recalculateMagicMana(player: Player): Player {
  const maxMana = getMaxManaForMagicLevel(getMagicLevel(player));
  const mana = Math.min(player.mana, maxMana);

  if (maxMana === player.maxMana && mana === player.mana) {
    return player;
  }

  return {
    ...player,
    mana,
    maxMana,
  };
}

export function gainSchoolXp(player: Player, school: RingSchool, amount: number): Player {
  const current = player.ringMastery[school] ?? { xp: 0 };
  const updatedPlayer = {
    ...player,
    ringMastery: { ...player.ringMastery, [school]: { xp: current.xp + amount } },
  };

  return recalculateMagicMana(updatedPlayer);
}

export function getFireMasteryLevel(player: Player): number {
  const xp = player.ringMastery['fire']?.xp ?? 0;
  return getSchoolMasteryLevelFromXp(xp);
}

export function learnRingSpell(player: Player, spellId: string): Player {
  if (player.learnedRingSpellIds.includes(spellId)) return player;
  return { ...player, learnedRingSpellIds: [...player.learnedRingSpellIds, spellId] };
}

export function getFireBurnDuration(player: Player, baseDuration: number): number {
  return baseDuration + getFireMasteryLevel(player) * MAGIC.burnDurationPerMasteryLevel;
}

export function getFireBurnMagnitude(player: Player): number {
  return 1 + getFireMasteryLevel(player) * MAGIC.burnDamagePerMasteryLevel;
}

export function getFireBurnSpreadRadius(player: Player): number {
  return MAGIC.burnSpreadRadius + getFireMasteryLevel(player) * MAGIC.burnSpreadRadiusPerMasteryLevel;
}

export function canFireMasteryPanicOnSpread(player: Player): boolean {
  return getFireMasteryLevel(player) >= MAGIC.panicOnBurnSpreadMasteryLevel;
}

export function canFireMasteryRestoreManaOnBurnKill(player: Player): boolean {
  return getFireMasteryLevel(player) >= MAGIC.burnKillManaRestoreMasteryLevel;
}
