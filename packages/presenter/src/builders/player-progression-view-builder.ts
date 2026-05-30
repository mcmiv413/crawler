import type { GameState } from '@dungeon/contracts';
import { BIOMES, XP_TABLE } from '@dungeon/content';
import type { PlayerHudView } from '../game-view.js';
import { buildFactionView, buildOgreProgressView } from './faction-progress-builder.js';
import { buildMasteryTierInfo } from './mastery-tier-builder.js';

export interface PlayerProgressionSection {
  readonly floor: number;
  readonly experienceForNextLevel: number;
  readonly biomeId: PlayerHudView['biomeId'];
  readonly biomeColor: string;
  readonly weaponMastery: PlayerHudView['weaponMastery'];
  readonly weaponMasteryTiers: PlayerHudView['weaponMasteryTiers'];
  readonly factionProgress: PlayerHudView['factionProgress'];
  readonly ogreProgress: PlayerHudView['ogreProgress'];
}

function buildFactionProgressViews(state: GameState): PlayerHudView['factionProgress'] {
  return state.world.factions.map(faction =>
    buildFactionView(
      faction,
      state.run === null
        ? []
        : Array.from(state.run.enemies.values())
            .filter(enemy =>
              enemy.factions?.some(candidate => candidate.factionId === faction.id),
            )
            .map(enemy => enemy.name),
    ),
  );
}

function getExperienceForNextLevel(level: number): number {
  const nextLevelIndex = level + 1;
  return nextLevelIndex < XP_TABLE.length
    ? XP_TABLE[nextLevelIndex]!
    : XP_TABLE[XP_TABLE.length - 1]!;
}

function buildBiomePresentation(
  state: GameState,
): Pick<PlayerProgressionSection, 'biomeId' | 'biomeColor'> {
  const biomeId = state.run?.floor.biomeId ?? null;

  return {
    biomeId,
    biomeColor: biomeId ? (BIOMES.get(biomeId)?.ambientColor ?? '#666') : '#666',
  };
}

function buildWeaponMasterySection(
  state: GameState,
): Pick<PlayerProgressionSection, 'weaponMastery' | 'weaponMasteryTiers'> {
  return state.run
    ? {
        weaponMastery: { ...state.weaponMastery },
        weaponMasteryTiers: buildMasteryTierInfo(state.weaponMastery),
      }
    : {
        weaponMastery: null,
        weaponMasteryTiers: [],
      };
}

export function buildPlayerProgressionSection(
  state: GameState,
): PlayerProgressionSection {
  const runFloor = state.run?.floor;
  const biomePresentation = buildBiomePresentation(state);
  const weaponMasterySection = buildWeaponMasterySection(state);

  return {
    floor: runFloor?.depth ?? state.player.floor,
    experienceForNextLevel: getExperienceForNextLevel(state.player.level),
    ...biomePresentation,
    ...weaponMasterySection,
    factionProgress: buildFactionProgressViews(state),
    ogreProgress: buildOgreProgressView(state.world),
  };
}
