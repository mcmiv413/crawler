import type { FastifyInstance } from 'fastify';
import type { EntityId, IGameRepository } from '@dungeon/contracts';
import { grantAbility } from '@dungeon/core';

interface DebugPatch {
  weaponMastery?: {
    blade?: number;
    bludgeon?: number;
    axe?: number;
    ranged?: number;
  };
  abilities?: string[];
  playerLevel?: number;
  unlockedBlueprints?: string[];
}

export function registerDebugRoutes(app: FastifyInstance, repo: IGameRepository): void {
  if (process.env['NODE_ENV'] === 'production') return;

  app.post<{ Params: { id: string }; Body: DebugPatch }>(
    '/api/debug/inject/:id',
    async (request, reply) => {
      const state = await repo.loadGame(request.params.id as EntityId);
      if (!state) return reply.code(404).send({ error: 'Game not found' });

      const patch = request.body;
      let newState = state;

      // Patch weapon mastery (requires active run)
      if (patch.weaponMastery && newState.run) {
        newState = {
          ...newState,
          run: {
            ...newState.run,
            weaponMastery: {
              ...newState.run.weaponMastery,
              ...patch.weaponMastery,
            },
          },
        };
      }

      // Grant abilities
      if (patch.abilities) {
        for (const abilityId of patch.abilities) {
          newState = grantAbility(newState, abilityId);
        }
      }

      // Unlock blueprints
      if (patch.unlockedBlueprints) {
        const existing = new Set(newState.world.unlockedBlueprints);
        const toAdd = patch.unlockedBlueprints.filter(id => !existing.has(id));
        if (toAdd.length > 0) {
          newState = {
            ...newState,
            world: {
              ...newState.world,
              unlockedBlueprints: [...newState.world.unlockedBlueprints, ...toAdd],
            },
          };
        }
      }

      // Set player level
      if (patch.playerLevel !== undefined) {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            level: patch.playerLevel,
          },
        };
      }

      await repo.saveGame(request.params.id as EntityId, newState);
      return reply.send({ ok: true });
    },
  );
}
