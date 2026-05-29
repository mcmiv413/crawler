import { animationRefs, type AnimationId } from '@dungeon/content';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAnimationModule,
  listAnimationIds,
  resetForTesting,
} from '../../apps/web/src/rendering/three/three-animation-registry.js';
import { initializeThreeAnimationModules } from '../../apps/web/src/rendering/three/generated/index.js';

function getAllContentAnimationIds(): AnimationId[] {
  const ids: AnimationId[] = [];
  for (const category of Object.values(animationRefs)) {
    for (const ref of Object.values(category)) {
      ids.push((ref as { id: AnimationId }).id);
    }
  }
  return ids;
}

export function collectThreeAnimationCoverageFailures(): string[] {
  resetForTesting();
  initializeThreeAnimationModules();

  const failures: string[] = [];
  const contentIds = getAllContentAnimationIds();
  const registeredIds = listAnimationIds();

  const missingIds = contentIds.filter((id) => getAnimationModule(id) === undefined);
  if (missingIds.length > 0) {
    failures.push(
      `Missing Three modules for: ${missingIds.join(', ')}`,
    );
  }

  const contentIdSet = new Set(contentIds);
  const unknownIds = registeredIds.filter((id) => !contentIdSet.has(id));
  if (unknownIds.length > 0) {
    failures.push(
      `Registered Three modules without a content animation ref: ${unknownIds.join(', ')}`,
    );
  }

  for (const id of registeredIds) {
    if (/^fx\.[a-z]+\.[a-z0-9-]+$/.test(id) === false) {
      failures.push(`Animation module ID has invalid format: ${id}`);
    }
  }

  for (const id of contentIds) {
    const module = getAnimationModule(id);
    if (module === undefined) {
      continue;
    }

    const categoryFromId = id.split('.')[1];
    if (module.category !== categoryFromId) {
      failures.push(
        `Animation module category mismatch for ${id}: expected ${categoryFromId}, got ${module.category}`,
      );
    }
  }

  resetForTesting();
  return failures.sort((left, right) => left.localeCompare(right));
}

function main(): void {
  const failures = collectThreeAnimationCoverageFailures();
  if (failures.length > 0) {
    console.error('Three animation coverage check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Three animation coverage check passed.');
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main();
}
