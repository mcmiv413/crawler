import type { EntityView } from '@dungeon/presenter';

export function detectNewThreats(
  knownEnemyIds: ReadonlySet<string>,
  currentEntities: readonly EntityView[],
): EntityView[] {
  return currentEntities.filter(
    e => e.type === 'enemy' && !knownEnemyIds.has(e.id),
  );
}
