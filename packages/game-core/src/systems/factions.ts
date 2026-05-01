import type {
  DomainEvent,
  DungeonOgreState,
  FactionLeaderState,
  FactionPowerBand,
  FactionPowerChangeReason,
  FactionState,
  WorldState,
} from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { FACTION_CONFIG, FACTION_DEFINITIONS } from '@dungeon/content';
import { SeededRNG } from '../utils/rng.js';

interface EventContext {
  readonly timestamp: number;
  readonly turnNumber: number;
  readonly depth: number;
}

interface FactionResult {
  readonly world: WorldState;
  readonly events: readonly DomainEvent[];
}

export interface TownImpact {
  readonly prosperityDelta: number;
  readonly corruptionDelta: number;
}

export function clampFactionPower(power: number): number {
  return Math.max(FACTION_CONFIG.power.min, Math.min(FACTION_CONFIG.power.max, power));
}

export function getFactionPowerBand(faction: FactionState): FactionPowerBand {
  if (faction.status === 'broken') {
    return 'broken';
  }
  if (faction.power <= FACTION_CONFIG.power.bands.weakMax) {
    return 'weak';
  }
  if (faction.power <= FACTION_CONFIG.power.bands.stableMax) {
    return 'stable';
  }
  if (faction.power <= FACTION_CONFIG.power.bands.strongMax) {
    return 'strong';
  }
  return 'dominant';
}

export function getFactionSpawnWeightMultiplier(faction: FactionState): number {
  return FACTION_CONFIG.spawning.weightMultiplierByBand[getFactionPowerBand(faction)];
}

export function getFactionMemberStrengthMultiplier(faction: FactionState): number {
  return FACTION_CONFIG.memberStrength.multiplierByBand[getFactionPowerBand(faction)];
}

export function applyFactionMemberKill(
  world: WorldState,
  factionId: string | undefined,
  context: EventContext,
): FactionResult {
  if (factionId === undefined) {
    return { world, events: [] };
  }

  const faction = world.factions.find(candidate => candidate.id === factionId);
  if (faction === undefined) {
    return { world, events: [] };
  }

  const updatedFaction = updateFactionPower(
    faction,
    -FACTION_CONFIG.power.memberKillPowerLoss,
    'member_killed',
  );
  const finalFaction: FactionState = {
    ...updatedFaction,
    membersKilledByPlayer: updatedFaction.membersKilledByPlayer + 1,
  };

  return {
    world: replaceFaction(world, finalFaction),
    events: [buildFactionPowerChangedEvent(faction, finalFaction, context)],
  };
}

export function applyFactionDeathConsequences(
  world: WorldState,
  factionId: string | undefined,
  context: EventContext,
): FactionResult {
  if (factionId === undefined) {
    return { world, events: [] };
  }

  const faction = world.factions.find(candidate => candidate.id === factionId);
  if (faction === undefined || faction.status === 'broken') {
    return { world, events: [] };
  }

  if (faction.status === 'leaderless') {
    const leader = buildLeaderState(faction, world, context.depth);
    const updatedFaction = updateFactionPower(
      faction,
      FACTION_CONFIG.power.playerDeathPowerGain,
      'player_death',
    );
    const finalFaction: FactionState = {
      ...updatedFaction,
      status: 'led',
      activeLeaderId: leader.id,
      leader,
      playerDeathsCaused: updatedFaction.playerDeathsCaused + 1,
    };

    return {
      world: replaceFaction(world, finalFaction),
      events: [
        buildFactionPowerChangedEvent(faction, finalFaction, context),
        {
          type: 'FACTION_LEADER_EMERGED',
          factionId: finalFaction.id,
          factionName: finalFaction.name,
          leaderId: leader.id,
          leaderName: leader.name,
          leaderTitle: leader.title,
          leaderTemplateId: leader.templateId,
          emergedOnRun: leader.emergedOnRun,
          emergedOnDepth: leader.emergedOnDepth,
          timestamp: context.timestamp,
          turnNumber: context.turnNumber,
        },
      ],
    };
  }

  const updatedFaction = updateFactionPower(
    faction,
    FACTION_CONFIG.power.playerDeathWithLeaderPowerGain,
    'player_death_with_leader',
  );
  const finalFaction: FactionState = {
    ...updatedFaction,
    playerDeathsCaused: updatedFaction.playerDeathsCaused + 1,
  };

  return {
    world: replaceFaction(world, finalFaction),
    events: [buildFactionPowerChangedEvent(faction, finalFaction, context)],
  };
}

export function applyFactionLeaderSlain(
  world: WorldState,
  factionId: string | undefined,
  context: EventContext,
  seed: number,
): FactionResult {
  if (factionId === undefined) {
    return { world, events: [] };
  }

  const faction = world.factions.find(candidate => candidate.id === factionId);
  if (faction === undefined || faction.leader === null) {
    return { world, events: [] };
  }

  const updatedFaction = updateFactionPower(
    faction,
    -FACTION_CONFIG.power.leaderKillPowerLoss,
    'leader_killed',
  );
  const slainLeader: FactionLeaderState = {
    ...faction.leader,
    isActive: false,
    isSlain: true,
  };
  const finalFaction: FactionState = {
    ...updatedFaction,
    status: 'broken',
    activeLeaderId: undefined,
    leader: slainLeader,
    leaderSlain: true,
    leadersKilledByPlayer: updatedFaction.leadersKilledByPlayer + 1,
  };

  const updatedWorld = replaceFaction(world, finalFaction);
  const baseEvents: DomainEvent[] = [
    {
      type: 'FACTION_LEADER_SLAIN',
      factionId: faction.id,
      factionName: faction.name,
      leaderId: slainLeader.id,
      leaderName: slainLeader.name,
      leaderTitle: slainLeader.title,
      slainAtDepth: context.depth,
      timestamp: context.timestamp,
      turnNumber: context.turnNumber,
    },
    buildFactionPowerChangedEvent(faction, finalFaction, context),
    {
      type: 'FACTION_BROKEN',
      factionId: faction.id,
      factionName: faction.name,
      leaderId: slainLeader.id,
      brokenAtDepth: context.depth,
      timestamp: context.timestamp,
      turnNumber: context.turnNumber,
    },
  ];

  const ogreResult = maybeEmergeDungeonOgre(updatedWorld, context, seed);
  return {
    world: ogreResult.world,
    events: [...baseEvents, ...ogreResult.events],
  };
}

export function applyDungeonOgreSlain(
  world: WorldState,
  context: EventContext,
): FactionResult {
  if (world.dungeonOgre.status !== 'emerged') {
    return { world, events: [] };
  }

  const dungeonOgre: DungeonOgreState = {
    ...world.dungeonOgre,
    status: 'slain',
  };

  return {
    world: {
      ...world,
      dungeonOgre,
    },
    events: [
      {
        type: 'DUNGEON_OGRE_SLAIN',
        ogreId: 'dungeon_ogre',
        slainAtDepth: context.depth,
        timestamp: context.timestamp,
        turnNumber: context.turnNumber,
      },
      {
        type: 'GAME_WON',
        victorySource: 'dungeon_ogre',
        floor: context.depth,
        timestamp: context.timestamp,
        turnNumber: context.turnNumber,
      },
    ],
  };
}

export function applyNewDeepestFloorPressure(
  world: WorldState,
  previousDeepestFloor: number,
  reachedDepth: number,
  context: EventContext,
): FactionResult {
  if (reachedDepth <= previousDeepestFloor) {
    return { world, events: [] };
  }

  let nextWorld = world;
  const events = world.factions
    .filter(faction => faction.status !== 'broken')
    .map((faction) => {
      const updatedFaction = updateFactionPower(
        faction,
        FACTION_CONFIG.power.newDeepestFloorPowerGain,
        'new_deepest_floor',
      );
      nextWorld = replaceFaction(nextWorld, updatedFaction);
      return buildFactionPowerChangedEvent(faction, updatedFaction, context);
    });

  return { world: nextWorld, events };
}

export function maybeEmergeDungeonOgre(
  world: WorldState,
  context: EventContext,
  seed: number,
): FactionResult {
  if (world.dungeonOgre.status !== 'sealed') {
    return { world, events: [] };
  }

  const allBroken = world.factions.every(faction => faction.status === 'broken' && faction.leaderSlain === true);
  if (allBroken === false) {
    return { world, events: [] };
  }

  const eligibleSpawnDepths = [world.deepestFloor + 1, world.deepestFloor + 2, world.deepestFloor + 3];
  const rng = new SeededRNG(seed + world.deepestFloor * 17 + world.totalRuns * 31 + context.depth * 13);
  const selectedSpawnDepth = rng.pick(eligibleSpawnDepths);
  const emergedAfterRun = world.totalRuns + 1;
  const dungeonOgre: DungeonOgreState = {
    id: 'dungeon_ogre',
    status: 'emerged',
    emergedAfterRun,
    emergedAtDepth: context.depth,
    eligibleSpawnDepths,
    selectedSpawnDepth,
  };

  return {
    world: {
      ...world,
      dungeonOgre,
    },
    events: [{
      type: 'DUNGEON_OGRE_EMERGED',
      ogreId: 'dungeon_ogre',
      emergedAfterRun,
      emergedAtDepth: context.depth,
      eligibleSpawnDepths,
      selectedSpawnDepth,
      timestamp: context.timestamp,
      turnNumber: context.turnNumber,
    }],
  };
}

export function calculateFactionTownImpact(factions: readonly FactionState[]): TownImpact {
  const uncapped = factions.reduce<TownImpact>((totals, faction) => {
    const baseImpact = FACTION_CONFIG.town.impactByBand[getFactionPowerBand(faction)];
    const ledModifier = faction.status === 'led' ? FACTION_CONFIG.town.activeLeaderImpactModifier : 0;
    return {
      prosperityDelta: totals.prosperityDelta + baseImpact.prosperityDelta - ledModifier,
      corruptionDelta: totals.corruptionDelta + baseImpact.corruptionDelta + ledModifier,
    };
  }, { prosperityDelta: 0, corruptionDelta: 0 });

  return {
    prosperityDelta: Math.max(
      -FACTION_CONFIG.town.maxProsperityLossPerRunFromFactions,
      Math.min(FACTION_CONFIG.town.maxProsperityGainPerRunFromFactions, uncapped.prosperityDelta),
    ),
    corruptionDelta: Math.max(
      -FACTION_CONFIG.town.maxCorruptionLossPerRunFromFactions,
      Math.min(FACTION_CONFIG.town.maxCorruptionGainPerRunFromFactions, uncapped.corruptionDelta),
    ),
  };
}

function updateFactionPower(
  faction: FactionState,
  delta: number,
  reason: FactionPowerChangeReason,
): FactionState {
  return {
    ...faction,
    power: clampFactionPower(faction.power + delta),
    lastPowerDelta: delta,
    lastPowerChangeReason: reason,
  };
}

function replaceFaction(world: WorldState, faction: FactionState): WorldState {
  return {
    ...world,
    factions: world.factions.map(candidate => candidate.id === faction.id ? faction : candidate),
  };
}

function buildFactionPowerChangedEvent(
  before: FactionState,
  after: FactionState,
  context: EventContext,
): DomainEvent {
  return {
    type: 'FACTION_POWER_CHANGED',
    factionId: after.id,
    factionName: after.name,
    reason: after.lastPowerChangeReason ?? 'member_killed',
    oldPower: before.power,
    newPower: after.power,
    delta: after.power - before.power,
    oldBand: getFactionPowerBand(before),
    newBand: getFactionPowerBand(after),
    status: after.status,
    timestamp: context.timestamp,
    turnNumber: context.turnNumber,
  };
}

function buildLeaderState(
  faction: FactionState,
  world: WorldState,
  depth: number,
): FactionLeaderState {
  const definition = FACTION_DEFINITIONS.get(faction.id);
  if (definition === undefined) {
    throw new Error(`Missing faction definition for ${faction.id}`);
  }

  const nameIndex = faction.playerDeathsCaused % definition.leader.names.length;
  const titleIndex = (world.totalRuns + faction.membersKilledByPlayer) % definition.leader.titles.length;

  return {
    id: entityId(`${faction.id}_leader`),
    factionId: faction.id,
    name: definition.leader.names[nameIndex]!,
    title: definition.leader.titles[titleIndex]!,
    templateId: definition.leader.templateId,
    isActive: true,
    isSlain: false,
    emergedOnRun: world.totalRuns + 1,
    emergedOnDepth: depth,
  };
}
