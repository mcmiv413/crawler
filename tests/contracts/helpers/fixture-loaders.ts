import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ScenarioFixture,
  ScenarioResolvers,
} from '../../../packages/game-core/src/fixtures/scenario-fixture-types.js';
import type { PlayerFixture } from '../../../packages/game-core/src/fixtures/player-fixture-types.js';
import type { WorldFixture } from '../../../packages/game-core/src/fixtures/world-fixture-types.js';

export const ROOT = process.cwd();
export const SCENARIOS_DIR = join(ROOT, 'fixtures/scenarios');
export const PLAYERS_DIR = join(ROOT, 'fixtures/players');
export const WORLDS_DIR = join(ROOT, 'fixtures/worlds');

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

export const RESOLVERS: ScenarioResolvers = {
  resolvePlayerFixture: ref => readJson<PlayerFixture>(join(PLAYERS_DIR, `${ref}.json`)),
  resolveWorldFixture: ref => readJson<WorldFixture>(join(WORLDS_DIR, `${ref}.json`)),
};

export function loadScenarioFile(name: string): ScenarioFixture {
  return readJson<ScenarioFixture>(join(SCENARIOS_DIR, `${name}.json`));
}
