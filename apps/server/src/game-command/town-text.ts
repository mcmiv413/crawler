import { calculateFactionTownImpact, getFactionPowerBand } from '@dungeon/core';
import {
  CORRUPTION_RISING_MESSAGES,
  FALLBACK_RUMORS,
  FACTION_RUMORS,
  PROSPERITY_RISING_MESSAGES,
} from '@dungeon/content';
import type {
  DomainEvent,
  FactionPowerBand,
  FactionState,
  GameState,
  RunMetrics,
} from '@dungeon/contracts';

const DEFAULT_RUMOR_COUNT = 3;

const BAND_PRIORITY: Record<FactionPowerBand, number> = {
  broken: 0,
  weak: 1,
  stable: 2,
  strong: 3,
  dominant: 4,
};

export function buildDeterministicTownRumors(
  state: GameState,
  rumorCount = DEFAULT_RUMOR_COUNT,
): readonly string[] {
  const rumors: string[] = [];
  const seedBase = buildSeedBase(state);
  const factions = getFactionPriority(state.world.factions);
  const townImpact = calculateFactionTownImpact(state.world.factions);

  for (const [index, faction] of factions.entries()) {
    pushUnique(rumors, buildFactionRumor(faction, seedBase + index * 11));
  }

  if (state.world.dungeonOgre.status === 'emerged') {
    pushUnique(
      rumors,
      'With every faction broken, whispers now turn to a Dungeon Ogre stalking the deeper halls.',
    );
  }

  if (townImpact.prosperityDelta > 0) {
    pushUnique(rumors, pickDeterministic(PROSPERITY_RISING_MESSAGES, seedBase + 17));
  }

  if (townImpact.corruptionDelta > 0) {
    pushUnique(rumors, pickDeterministic(CORRUPTION_RISING_MESSAGES, seedBase + 23));
  }

  let fallbackOffset = 0;
  while (rumors.length < rumorCount) {
    pushUnique(rumors, pickDeterministic(FALLBACK_RUMORS, seedBase + 29 + fallbackOffset));
    fallbackOffset += 1;
  }

  return rumors.slice(0, rumorCount);
}

export function buildDeterministicRunSummary(
  state: GameState,
  metrics: RunMetrics,
  events: readonly DomainEvent[],
): string {
  const summaryParts = [buildRunOutcomeSentence(state, metrics)];
  const eventHeadline = buildEventHeadline(events);

  if (eventHeadline !== null) {
    summaryParts.push(eventHeadline);
  } else {
    summaryParts.push(buildFactionPressureSentence(state.world.factions, state.world.dungeonOgre.status));
  }

  summaryParts.push(buildTownImpactSentence(state.world.factions));
  return summaryParts.join(' ');
}

function buildSeedBase(state: GameState): number {
  return state.world.totalRuns * 17
    + state.world.deepestFloor * 13
    + state.world.town.prosperity
    - state.world.town.corruption;
}

function getFactionPriority(factions: readonly FactionState[]): readonly FactionState[] {
  return [...factions].sort((left, right) => {
    const leftBand = getFactionPowerBand(left);
    const rightBand = getFactionPowerBand(right);
    if (BAND_PRIORITY[rightBand] !== BAND_PRIORITY[leftBand]) {
      return BAND_PRIORITY[rightBand] - BAND_PRIORITY[leftBand];
    }
    if ((right.status === 'led') !== (left.status === 'led')) {
      return right.status === 'led' ? 1 : -1;
    }
    if (right.power !== left.power) {
      return right.power - left.power;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildFactionRumor(faction: FactionState, seed: number): string | null {
  const band = getFactionPowerBand(faction);
  const rumorPool = FACTION_RUMORS[faction.id];

  if (rumorPool !== undefined && (faction.status === 'led' || band === 'strong' || band === 'dominant')) {
    return pickDeterministic(rumorPool, seed + faction.power);
  }

  if (faction.status === 'broken') {
    return `${faction.name} has been broken, but the town still watches the wounds it left behind.`;
  }

  if (faction.status === 'led' && faction.leader !== null) {
    return `${faction.name} now marches under ${faction.leader.name} ${faction.leader.title}.`;
  }

  return null;
}

function buildRunOutcomeSentence(state: GameState, metrics: RunMetrics): string {
  const playerName = state.player.name;
  const floor = metrics.causeOfEnd === 'retreat'
    ? (state.lastRetreatFloor ?? state.player.floor)
    : state.player.floor;

  switch (metrics.causeOfEnd) {
    case 'death':
      return `${playerName} fell on floor ${floor} after slaying ${metrics.enemiesKilled} foes.`;
    case 'victory':
      return `${playerName} slew the Dungeon Ogre on floor ${floor} after slaying ${metrics.enemiesKilled} foes.`;
    case 'retreat':
      return `${playerName} retreated from floor ${floor} with ${metrics.goldEarned} gold and ${metrics.enemiesKilled} kills.`;
    case null:
      return `${playerName} returned from floor ${floor} with ${metrics.enemiesKilled} recorded kills.`;
  }
}

function buildEventHeadline(events: readonly DomainEvent[]): string | null {
  if (events.some(event => event.type === 'DUNGEON_OGRE_EMERGED')) {
    return 'All factions are broken, and the Dungeon Ogre has emerged.';
  }

  const brokenFactions = events.filter(
    (event): event is Extract<DomainEvent, { type: 'FACTION_BROKEN' }> => event.type === 'FACTION_BROKEN',
  );
  if (brokenFactions.length === 1) {
    return `${brokenFactions[0]!.factionName} has been broken.`;
  }
  if (brokenFactions.length > 1) {
    return `${brokenFactions.length} factions were broken this run.`;
  }

  const emergedLeader = events.find(
    (event): event is Extract<DomainEvent, { type: 'FACTION_LEADER_EMERGED' }> => event.type === 'FACTION_LEADER_EMERGED',
  );
  if (emergedLeader !== undefined) {
    return `${emergedLeader.factionName} rallied behind ${emergedLeader.leaderName} ${emergedLeader.leaderTitle}.`;
  }

  return null;
}

function buildFactionPressureSentence(
  factions: readonly FactionState[],
  ogreStatus: GameState['world']['dungeonOgre']['status'],
): string {
  if (ogreStatus === 'emerged') {
    return 'All factions are broken, and the Dungeon Ogre now stalks the deeper halls.';
  }

  const strongestFaction = getFactionPriority(
    factions.filter(faction => faction.status !== 'broken'),
  )[0];
  const brokenCount = factions.filter(faction => faction.status === 'broken').length;

  if (strongestFaction === undefined) {
    return brokenCount > 0
      ? `${brokenCount} factions have already been broken.`
      : 'Faction pressure is quiet for now.';
  }

  const band = getFactionPowerBand(strongestFaction);
  const leaderClause = strongestFaction.status === 'led' && strongestFaction.leader !== null
    ? ` under ${strongestFaction.leader.name} ${strongestFaction.leader.title}`
    : '';
  const pressureLead = band === 'dominant' || band === 'strong'
    ? 'Faction pressure is rising.'
    : band === 'stable'
      ? 'Faction pressure is holding steady.'
      : 'Faction pressure has eased for now.';
  const brokenClause = brokenCount > 0
    ? ` ${brokenCount} faction${brokenCount === 1 ? ' has' : 's have'} already been broken.`
    : '';

  return `${pressureLead} ${strongestFaction.name} is ${band}${leaderClause}.${brokenClause}`;
}

function buildTownImpactSentence(factions: readonly FactionState[]): string {
  const { prosperityDelta, corruptionDelta } = calculateFactionTownImpact(factions);

  if (prosperityDelta === 0 && corruptionDelta === 0) {
    return 'Faction pressure left town conditions unchanged.';
  }

  const prosperityText = prosperityDelta === 0
    ? 'prosperity held steady'
    : prosperityDelta > 0
      ? `prosperity rose by ${prosperityDelta}`
      : `prosperity fell by ${Math.abs(prosperityDelta)}`;
  const corruptionText = corruptionDelta === 0
    ? 'corruption held steady'
    : corruptionDelta > 0
      ? `corruption rose by ${corruptionDelta}`
      : `corruption fell by ${Math.abs(corruptionDelta)}`;

  return `Town ${prosperityText} and ${corruptionText}.`;
}

function pickDeterministic<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!;
}

function pushUnique(target: string[], value: string | null): void {
  if (value !== null && !target.includes(value)) {
    target.push(value);
  }
}
