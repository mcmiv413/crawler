import type { GameState } from '@dungeon/contracts';
import { getPlayerOffensePreview } from '@dungeon/core';
import type { PlayerHudView } from '../game-view.js';
import { calculateStatBreakdown } from './stat-breakdown-builder.js';
import { buildAbilityList } from './player-ability-view-builder.js';
import {
  buildEquippedItems,
  getEquippedWeaponType,
} from './player-equipment-view-builder.js';
import { buildRingMagicSection } from './player-magic-view-builder.js';
import { buildPlayerProgressionSection } from './player-progression-view-builder.js';
import { buildActiveQuestViews } from './player-quest-view-builder.js';
import { buildStatusList } from './player-status-view-builder.js';

export function buildPlayerHud(state: GameState): PlayerHudView {
  const player = state.player;
  const equippedWeaponType = getEquippedWeaponType(state);
  const offensePreview = getPlayerOffensePreview(state);
  const ringMagic = buildRingMagicSection(state);
  const progression = buildPlayerProgressionSection(state);

  return {
    name: player.name,
    level: player.level,
    health: player.stats.health,
    maxHealth: player.stats.maxHealth,
    ...(ringMagic.hasRingMagic
      ? {
          mana: player.mana,
          maxMana: player.maxMana,
          magicExperience: ringMagic.totalMagicXp,
          magicLevel: ringMagic.magicLevel,
          magicExperienceForNextLevel: ringMagic.nextMagicLevelXp,
          spellPower: 1,
        }
      : {}),
    attack: offensePreview.attack,
    defense: player.stats.defense,
    accuracy: player.stats.accuracy,
    evasion: player.stats.evasion,
    speed: player.stats.speed,
    totalDamageMin: offensePreview.totalDamageMin,
    totalDamageMax: offensePreview.totalDamageMax,
    resistances: player.stats.resistances ?? {},
    gold: player.gold,
    floor: progression.floor,
    experience: player.experience,
    experienceForNextLevel: progression.experienceForNextLevel,
    biomeId: progression.biomeId,
    biomeColor: progression.biomeColor,
    statuses: buildStatusList(state),
    abilities: buildAbilityList(state, equippedWeaponType),
    weaponMastery: progression.weaponMastery,
    weaponMasteryTiers: progression.weaponMasteryTiers,
    equippedItems: buildEquippedItems(state),
    statBreakdowns: calculateStatBreakdown(state),
    activeQuests: buildActiveQuestViews(state),
    factionProgress: progression.factionProgress,
    ogreProgress: progression.ogreProgress,
    ringSchoolMasteries: ringMagic.ringSchoolMasteries,
    learnedSpells: ringMagic.learnedSpells,
    studyableSpells: ringMagic.studyableSpells,
  };
}
