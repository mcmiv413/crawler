import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { GameEngine } from '@dungeon/core';
import type { AiService } from '@dungeon/core/ai/ai-service.js';
import type { IGameRepository } from '@dungeon/contracts';

import { CompositeAiService } from './ai/ai-service-composite.js';
import { InMemoryRepository } from './in-memory-repository.js';
import { registerDebugRoutes } from './routes/debug.js';
import { registerGameRoutes } from './routes/register-game-routes.js';
import { registerRestoreRoutes } from './routes/register-restore-routes.js';

interface BuildAppOptions {
  readonly ai?: AiService;
  readonly engine?: GameEngine;
  readonly repo?: IGameRepository;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const engine = options.engine ?? new GameEngine();
  const repo = options.repo ?? (await createRepository());
  const ai = options.ai ?? new CompositeAiService();

  logServerConfiguration(app);
  registerGameRoutes(app, { ai, engine, repo });
  registerRestoreRoutes(app, { repo });
  registerDebugRoutes(app, repo);

  return app;
}

async function createRepository(): Promise<IGameRepository> {
  const dbPath = process.env.DUNGEON_DB_PATH;
  if (dbPath) {
    const { SqliteRepository } = await import('./sqlite-repository.js');
    return new SqliteRepository(dbPath);
  }

  return new InMemoryRepository();
}

function logServerConfiguration(app: FastifyInstance): void {
  const dbPath = process.env.DUNGEON_DB_PATH;
  const lmHost = process.env['LM_HOST'];
  const lmPort = process.env['LM_PORT'] ?? '1234';

  app.log.info(`Repository: ${dbPath ? `SQLite (${dbPath})` : 'in-memory (non-durable)'}`);
  app.log.info(
    `AI: ${lmHost ? `LM Studio at ${lmHost}:${lmPort} (with fallback)` : 'fallback-only (LM_HOST not set)'}`,
  );
}
