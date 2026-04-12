import type { FastifyInstance } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from './app.js';

let app: FastifyInstance | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    const instance = await buildApp();
    await instance.ready();
    app = instance;
  }
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const fastify = await getApp();
  fastify.routing(req, res);
}
