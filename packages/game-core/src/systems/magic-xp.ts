import type { Player } from '@dungeon/contracts';
import { MAGIC } from '@dungeon/content';

export function gainSchoolXp(player: Player, school: string, amount: number): Player {
  const current = player.ringMastery[school] ?? { xp: 0 };
  const newXp = current.xp + amount;
  const newMasteryLevel = newXp >= 60 ? 2 : newXp >= 20 ? 1 : 0;
  const newMaxMana = MAGIC.initialMana + newMasteryLevel * MAGIC.manaPerMasteryTier;

  return {
    ...player,
    maxMana: Math.max(player.maxMana, newMaxMana),
    ringMastery: { ...player.ringMastery, [school]: { xp: newXp } },
  };
}

export function getFireMasteryLevel(player: Player): number {
  const xp = player.ringMastery['fire']?.xp ?? 0;
  return xp >= 60 ? 2 : xp >= 20 ? 1 : 0;
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
