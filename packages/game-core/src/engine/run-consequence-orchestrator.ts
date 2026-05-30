import type { CommandResult } from '@dungeon/contracts';
import { applyRunConsequences } from '../systems/world-consequences.js';

export function applyRunConsequencesIfEnded(result: CommandResult): CommandResult {
  if (result.runEnded !== true) {
    return result;
  }

  const runMetrics = result.state.run?.runMetrics ?? result.state.lastRunMetrics;
  if (runMetrics === undefined) {
    return result;
  }

  const consequenceResult = applyRunConsequences(result.state, runMetrics, result.events);
  return {
    state: consequenceResult.state,
    events: [...result.events, ...consequenceResult.events],
    runEnded: result.runEnded,
  };
}
