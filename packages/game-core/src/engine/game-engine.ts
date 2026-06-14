import type { GameState, GameCommand } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import type { IGameEngine, CommandResult } from '@dungeon/contracts';
import { generateId } from '../utils/id.js';
import { BASE_PLAYER_STATS, ECONOMY, MAGIC } from '@dungeon/content';
import { EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import { SeededRNG } from '../utils/rng.js';
import { handleCommand } from './command-handler.js';
import { createInitialWorldState } from '../state/world-state.js';
import { evaluateAllQuestProgress } from './quest-evaluator.js';
import { appendEventHistory } from './event-history.js';
import { applyRunConsequencesIfEnded } from './run-consequence-orchestrator.js';
import {
  ascendFloor,
  descendFloor,
  enterDungeon,
} from './floor-transition-service.js';

export class GameEngine implements IGameEngine {
  createNewGame(seed: number): GameState {
    const gameId = entityId(generateId());
    const playerId = entityId(generateId());
    const rng = new SeededRNG(seed);

    const state: GameState = {
      gameId,
      phase: 'town',
      player: {
        id: playerId,
        name: 'Adventurer',
        level: 1,
        experience: 0,
        stats: { ...BASE_PLAYER_STATS },
        baseStats: { ...BASE_PLAYER_STATS },
        position: { x: 0, y: 0 },
        equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        inventory: [],
        statuses: [],
        abilities: [],
        gold: ECONOMY.startingGold,
        floor: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalRuns: 0,
        deathStash: null,
        mana: MAGIC.initialMana,
        maxMana: MAGIC.initialMana,
        ringMastery: {},
        learnedRingSpellIds: [],
        knownRingSchools: [],
      },
      run: null,
      world: createInitialWorldState(rng),
      itemRegistry: { items: new Map() },
      seed,
      turnNumber: 0,
      version: 1,
      activeQuests: [],
      weaponMastery: EMPTY_WEAPON_MASTERY,
    };

    return state;
  }

  submitCommand(state: GameState, command: GameCommand): CommandResult {
    const rng = new SeededRNG(state.seed + state.turnNumber);

    // Special handling: enter dungeon generates a new floor
    if (command.type === 'TOWN_ACTION' && command.action === 'enter_dungeon') {
      return this.finalizeCommandResult(enterDungeon(state, rng, command.startDepth), false);
    }

    // Special handling: ascend command
    if (command.type === 'ASCEND' && state.run) {
      return this.finalizeCommandResult(ascendFloor(state, [], rng), false);
    }

    // Special handling: descend/ascend stairs on move
    if (command.type === 'MOVE' && state.run) {
      const result = handleCommand(state, command, rng);
      if (result.state.run && !result.runEnded) {
        const playerKey = posKey(result.state.player.position);
        const cell = result.state.run.floor.cells.get(playerKey);
        if (cell?.tile.type === 'stairs_down') {
          return this.finalizeCommandResult(descendFloor(result.state, rng, result.events), false);
        }
        if (cell?.tile.type === 'stairs_up' && result.state.player.floor > 1) {
          // Auto-ascend only when there's a prior floor to return to.
          // On floor 1 (no history), stairs_up is the entrance — use RETREAT to leave.
          return this.finalizeCommandResult(ascendFloor(result.state, result.events, rng), false);
        }
      }
      return this.finalizeCommandResult(result, false);
    }

    return this.finalizeCommandResult(handleCommand(state, command, rng), true);
  }

  private finalizeCommandResult(
    result: CommandResult,
    evaluateQuestProgress: boolean,
  ): CommandResult {
    const afterConsequences = applyRunConsequencesIfEnded(result);

    if (evaluateQuestProgress !== true) {
      return {
        state: appendEventHistory(afterConsequences.state, afterConsequences.events),
        events: afterConsequences.events,
        runEnded: afterConsequences.runEnded,
      };
    }

    const questEval = evaluateAllQuestProgress(afterConsequences.state);
    const events = [...afterConsequences.events, ...questEval.events];

    return {
      state: appendEventHistory(questEval.state, events),
      events,
      runEnded: afterConsequences.runEnded,
    };
  }
}
