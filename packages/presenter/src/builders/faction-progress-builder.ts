import type { FactionPowerBand, FactionState, WorldState } from '@dungeon/contracts';
import { ENEMY_TEMPLATES, FACTIONS, FACTION_CONFIG } from '@dungeon/content';
import { getFactionPowerBand } from '@dungeon/core';
import type { FactionLeaderView, FactionView, OgreProgressView } from '../game-view.js';

function formatBandMultiplier(multiplier: number): string {
  return `${Math.round(multiplier * 100)}%`;
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function buildLeaderView(faction: FactionState): FactionLeaderView {
  const leader = faction.leader;
  const spriteName = leader ? ENEMY_TEMPLATES.get(leader.templateId)?.spriteName : undefined;

  if (leader === null) {
    return {
      state: 'leaderless',
      name: null,
      title: null,
      templateId: null,
    };
  }

  return {
    state: faction.status === 'led' && leader.isActive ? 'emerged' : 'slain',
    name: leader.name,
    title: leader.title,
    templateId: leader.templateId,
    spriteName,
    emergedOnDepth: leader.emergedOnDepth,
    emergedOnRun: leader.emergedOnRun,
  };
}

function buildWorldEffectText(faction: FactionState, powerBand: FactionPowerBand): string {
  const spawnMultiplier = FACTION_CONFIG.spawning.weightMultiplierByBand[powerBand];
  const strengthMultiplier = FACTION_CONFIG.memberStrength.multiplierByBand[powerBand];
  const leaderClause = faction.status === 'led'
    ? ' Active leader pressure is in play.'
    : faction.status === 'broken'
      ? ' The faction is broken and cannot produce another leader.'
      : ' No active leader has emerged yet.';

  if (powerBand === 'stable') {
    return `Stable dungeon pressure: members spawn at normal rates and fight at baseline strength.${leaderClause}`;
  }

  return `${powerBand[0]!.toUpperCase()}${powerBand.slice(1)} dungeon pressure: members spawn at ${formatBandMultiplier(spawnMultiplier)} and fight at ${formatBandMultiplier(strengthMultiplier)} strength.${leaderClause}`;
}

function buildTownEffectText(faction: FactionState, powerBand: FactionPowerBand): string {
  const bandImpact = FACTION_CONFIG.town.impactByBand[powerBand];
  const ledModifier = faction.status === 'led' ? FACTION_CONFIG.town.activeLeaderImpactModifier : 0;
  const prosperityDelta = bandImpact.prosperityDelta - ledModifier;
  const corruptionDelta = bandImpact.corruptionDelta + ledModifier;

  if (prosperityDelta === 0 && corruptionDelta === 0) {
    return 'Town effect per run: no prosperity or corruption swing.';
  }

  return `Town effect per run: prosperity ${formatDelta(prosperityDelta)}, corruption ${formatDelta(corruptionDelta)}.`;
}

export function buildFactionView(
  faction: FactionState,
  currentDungeonEnemies: readonly string[] = [],
): FactionView {
  const powerBand = getFactionPowerBand(faction);
  const definition = FACTIONS.get(faction.id);

  return {
    id: faction.id,
    name: faction.name,
    description: definition?.description ?? '',
    lore: definition?.lore ?? '',
    power: faction.power,
    disposition: faction.disposition,
    status: faction.status,
    powerBand,
    leader: buildLeaderView(faction),
    membersKilledByPlayer: faction.membersKilledByPlayer,
    leadersKilledByPlayer: faction.leadersKilledByPlayer,
    playerDeathsCaused: faction.playerDeathsCaused,
    worldEffectText: buildWorldEffectText(faction, powerBand),
    townEffectText: buildTownEffectText(faction, powerBand),
    currentDungeonEnemies,
  };
}

export function buildOgreProgressView(world: WorldState): OgreProgressView {
  const brokenFactions = world.factions.filter(faction => faction.status === 'broken').length;
  const totalFactions = world.factions.length;
  const remainingFactions = Math.max(0, totalFactions - brokenFactions);
  const eligibleSpawnDepths = world.dungeonOgre.eligibleSpawnDepths ? [...world.dungeonOgre.eligibleSpawnDepths] : [];
  const selectedSpawnDepth = world.dungeonOgre.selectedSpawnDepth ?? null;

  let summaryText: string;
  switch (world.dungeonOgre.status) {
    case 'emerged':
      summaryText = selectedSpawnDepth === null
        ? 'All factions are broken. The Dungeon Ogre has emerged.'
        : `All factions are broken. The Dungeon Ogre has claimed floor ${selectedSpawnDepth}.`;
      break;
    case 'slain':
      summaryText = 'The Dungeon Ogre is slain. The endgame threat is over.';
      break;
    default:
      summaryText = remainingFactions === 0
        ? 'All factions are broken. The Dungeon Ogre is ready to emerge.'
        : `${brokenFactions}/${totalFactions} factions broken. Break ${remainingFactions} more to reveal the Dungeon Ogre.`;
      break;
  }

  return {
    status: world.dungeonOgre.status,
    selectedSpawnDepth,
    eligibleSpawnDepths,
    brokenFactions,
    totalFactions,
    summaryText,
  };
}

export function buildFactionPressureSummary(world: WorldState): string {
  const ledCount = world.factions.filter(faction => faction.status === 'led').length;
  const leaderlessCount = world.factions.filter(faction => faction.status === 'leaderless').length;
  const brokenCount = world.factions.filter(faction => faction.status === 'broken').length;

  return `${ledCount} led · ${leaderlessCount} leaderless · ${brokenCount} broken.`;
}
