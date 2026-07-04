import { calculateFactionTownImpact, getFactionPowerBand } from '@dungeon/core';
import {
  CORRUPTION_RISING_MESSAGES,
  FALLBACK_RUMORS,
  FACTION_RUMORS,
  PROSPERITY_RISING_MESSAGES,
} from '@dungeon/content';
import type {
  FactionPowerBand,
  FactionState,
  GameState,
  RunMetrics,
} from '@dungeon/contracts';
import { sortedCopy } from '@dungeon/contracts';

const DEFAULT_RUMOR_COUNT = 3;

const BAND_PRIORITY: Record<FactionPowerBand, number> = {
  broken: 0,
  weak: 1,
  stable: 2,
  strong: 3,
  dominant: 4,
};

/**
 * Presentation text: deterministic town rumors derived purely from GameState.
 * Lives in the presenter (read model) so the server never writes display
 * strings into persisted state.
 */
export function buildDeterministicTownRumors(
  state: GameState,
  rumorCount = DEFAULT_RUMOR_COUNT,
): readonly string[] {
  const seedBase = buildSeedBase(state);
  const factions = getFactionPriority(state.world.factions);
  const townImpact = calculateFactionTownImpact(state.world.factions);

  const candidateRumors = [
    ...factions.map((faction, index) => buildFactionRumor(faction, seedBase + index * 11)),
    ...(state.world.dungeonOgre.status === 'emerged'
      ? ['With every faction broken, whispers now turn to a Dungeon Ogre stalking the deeper halls.']
      : []),
    ...(townImpact.prosperityDelta > 0
      ? [pickDeterministic(PROSPERITY_RISING_MESSAGES, seedBase + 17)]
      : []),
    ...(townImpact.corruptionDelta > 0
      ? [pickDeterministic(CORRUPTION_RISING_MESSAGES, seedBase + 23)]
      : []),
  ];

  return fillWithFallbackRumors(collectUniqueRumors(candidateRumors), rumorCount, seedBase);
}

/**
 * Presentation text: deterministic last-run summary derived from GameState and
 * the persisted run metrics.
 */
export function buildDeterministicRunSummary(
  state: GameState,
  metrics: RunMetrics,
): string {
  const pressureSentence = buildFactionPressureSentence(
    state.world.factions,
    state.world.dungeonOgre.status,
  );

  return [
    buildRunOutcomeSentence(state, metrics),
    pressureSentence,
    buildTownImpactSentence(state.world.factions),
  ].join(' ');
}

function buildSeedBase(state: GameState): number {
  return state.world.totalRuns * 17
    + state.world.deepestFloor * 13
    + state.world.town.prosperity
    - state.world.town.corruption;
}

function getFactionPriority(factions: readonly FactionState[]): readonly FactionState[] {
  const sortedFactions = sortedCopy(factions, (left, right) => {
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
  return sortedFactions;
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

function collectUniqueRumors(values: readonly (string | null)[]): readonly string[] {
  return values.reduce<readonly string[]>((rumors, value) => {
    return value !== null && !rumors.includes(value) ? [...rumors, value] : rumors;
  }, []);
}

function fillWithFallbackRumors(
  rumors: readonly string[],
  rumorCount: number,
  seedBase: number,
): readonly string[] {
  if (rumors.length >= rumorCount) {
    return rumors.slice(0, rumorCount);
  }

  // Two passes preserve the prior ordering for negative seeds that cross zero.
  const fallbackCandidates = Array.from(
    { length: FALLBACK_RUMORS.length * 2 },
    (_, fallbackOffset) => pickDeterministic(FALLBACK_RUMORS, seedBase + 29 + fallbackOffset),
  );
  return Array.from(new Set([...rumors, ...fallbackCandidates])).slice(0, rumorCount);
}
