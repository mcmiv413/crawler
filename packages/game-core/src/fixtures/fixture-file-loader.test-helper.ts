import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PlayerFixture } from './player-fixture-types.js';
import type { WorldFixture } from './world-fixture-types.js';

export const FIXTURES_DIR = join(process.cwd(), 'fixtures');
export const PLAYER_FIXTURES_DIR = join(FIXTURES_DIR, 'players');
export const WORLD_FIXTURES_DIR = join(FIXTURES_DIR, 'worlds');

export function loadFixtureJson<T>(directory: string, name: string): T {
  const filePath = join(directory, `${name}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export function loadPlayerFixtureFile(name: string): PlayerFixture {
  return loadFixtureJson<PlayerFixture>(PLAYER_FIXTURES_DIR, name);
}

export function loadWorldFixtureFile(name: string): WorldFixture {
  return loadFixtureJson<WorldFixture>(WORLD_FIXTURES_DIR, name);
}
