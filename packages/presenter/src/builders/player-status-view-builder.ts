import type { GameState } from '@dungeon/contracts';
import { STATUS_DEFINITIONS } from '@dungeon/content';
import type { StatusView } from '../game-view.js';
import { getStatusPresentation } from '../animation-metadata.js';

export function buildStatusList(state: GameState): StatusView[] {
  return state.player.statuses.map(status => {
    const definition = STATUS_DEFINITIONS.get(status.id);
    const presentation = getStatusPresentation(status.id);

    return {
      id: status.id,
      name: definition?.name ?? status.id,
      turnsRemaining: status.turnsRemaining,
      beneficial: definition?.beneficial ?? false,
      ...(presentation !== undefined ? { presentation } : {}),
    } satisfies StatusView;
  });
}
