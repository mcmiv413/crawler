import { describe, it, expect, beforeEach, vi } from 'vitest';
import fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { IGameRepository } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { registerDebugRoutes } from './debug.js';
import { createTestGameState, createTestRunState } from '@dungeon/core/testing';

describe('debug routes', () => {
  let app: FastifyInstance;
  let mockRepo: IGameRepository;

  const testGameId = entityId('test-game-1');
  const testGameState = createTestGameState();

  beforeEach(async () => {
    app = fastify();

    mockRepo = {
      loadGame: vi.fn().mockResolvedValue(testGameState),
      saveGame: vi.fn().mockResolvedValue(undefined),
      listGames: vi.fn().mockResolvedValue([]),
      deleteGame: vi.fn().mockResolvedValue(undefined),
      appendEvents: vi.fn().mockResolvedValue(undefined),
    } as unknown as IGameRepository;

    registerDebugRoutes(app, mockRepo);
    await app.ready();
  });

  it('skips registering routes in production', async () => {
    const prodApp = fastify();
    const originalEnv = process.env['NODE_ENV'];

    try {
      process.env['NODE_ENV'] = 'production';

      const spyLoad = vi.spyOn(mockRepo, 'loadGame');

      registerDebugRoutes(prodApp, mockRepo);
      await prodApp.ready();

      const result = await prodApp.inject({
        method: 'POST',
        url: `/api/debug/inject/${testGameId}`,
        payload: { playerLevel: 5 },
      });

      expect(result.statusCode).toBe(404); // Route not found
      expect(spyLoad).not.toHaveBeenCalled();

      await prodApp.close();
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('returns 404 when game not found', async () => {
    vi.mocked(mockRepo.loadGame).mockResolvedValueOnce(null);

    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: { playerLevel: 5 },
    });

    expect(result.statusCode).toBe(404);
    expect(result.json()).toEqual({ error: 'Game not found' });
  });

  it('patches player level', async () => {
    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: { playerLevel: 5 },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ ok: true });

    expect(mockRepo.saveGame).toHaveBeenCalledWith(
      testGameId,
      expect.objectContaining({
        player: expect.objectContaining({
          level: 5,
        }),
      })
    );
  });

  it('patches weapon mastery when run exists', async () => {
    const run = createTestRunState();
    const stateWithRun = { ...createTestGameState({ phase: 'dungeon' }), run };
    vi.mocked(mockRepo.loadGame).mockResolvedValueOnce(stateWithRun);

    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        weaponMastery: {
          blade: 3,
          axe: 2,
        },
      },
    });

    expect(result.statusCode).toBe(200);

    expect(mockRepo.saveGame).toHaveBeenCalledWith(
      testGameId,
      expect.objectContaining({
        run: expect.objectContaining({
          weaponMastery: expect.objectContaining({
            blade: 3,
            axe: 2,
          }),
        }),
      })
    );
  });

  it('ignores weapon mastery patch when no run', async () => {
    vi.mocked(mockRepo.loadGame).mockResolvedValueOnce(testGameState);

    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        weaponMastery: {
          blade: 3,
        },
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    // weaponMastery patch should be ignored when run is null
    expect(savedState?.run).toBeNull();
  });

  it('grants abilities', async () => {
    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        abilities: ['power_strike', 'second_wind'],
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(
      savedState?.player.abilities.some((a) => a.id === 'power_strike')
    ).toBe(true);
    expect(
      savedState?.player.abilities.some((a) => a.id === 'second_wind')
    ).toBe(true);
  });

  it('grants ability that is already known', async () => {
    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        abilities: ['power_strike'],
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(
      savedState?.player.abilities.some((a) => a.id === 'power_strike')
    ).toBe(true);
  });

  it('unlocks blueprints', async () => {
    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        unlockedBlueprints: ['shield_of_thorns', 'helm_of_vigor'],
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState?.world.unlockedBlueprints).toContain('shield_of_thorns');
    expect(savedState?.world.unlockedBlueprints).toContain('helm_of_vigor');
  });

  it('does not duplicate blueprints when unlocking already-known ones', async () => {
    const initialCount =
      testGameState.world.unlockedBlueprints.length;

    vi.mocked(mockRepo.loadGame).mockResolvedValueOnce(testGameState);

    await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        unlockedBlueprints: [
          testGameState.world.unlockedBlueprints[0] || 'known_blueprint',
        ],
      },
    });

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState?.world.unlockedBlueprints.length).toBeLessThanOrEqual(
      initialCount + 1
    );
  });

  it('combines multiple patches in single request', async () => {
    const run = createTestRunState();
    const stateWithRun = { ...createTestGameState({ phase: 'dungeon' }), run };
    vi.mocked(mockRepo.loadGame).mockResolvedValueOnce(stateWithRun);

    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        playerLevel: 10,
        weaponMastery: { blade: 5 },
        abilities: ['power_strike'],
        unlockedBlueprints: ['test_blueprint'],
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState?.player.level).toBe(10);
    expect(savedState?.run?.weaponMastery.blade).toBe(5);
    expect(
      savedState?.player.abilities.some((a) => a.id === 'power_strike')
    ).toBe(true);
    expect(savedState?.world.unlockedBlueprints).toContain('test_blueprint');
  });

  it('persists unchanged fields when patching', async () => {
    const originalName = testGameState.player.name;
    const originalGold = testGameState.player.gold;

    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        playerLevel: 7,
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState?.player.name).toBe(originalName);
    expect(savedState?.player.gold).toBe(originalGold);
  });

  it('handles empty abilities array', async () => {
    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        abilities: [],
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(Array.isArray(savedState?.player.abilities)).toBe(true);
  });

  it('handles empty blueprints array', async () => {
    const initialCount =
      testGameState.world.unlockedBlueprints.length;

    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        unlockedBlueprints: [],
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState?.world.unlockedBlueprints.length).toBe(initialCount);
  });

  it('handles empty weaponMastery patch', async () => {
    const run = createTestRunState();
    const stateWithRun = { ...createTestGameState({ phase: 'dungeon' }), run };
    vi.mocked(mockRepo.loadGame).mockResolvedValueOnce(stateWithRun);

    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        weaponMastery: {},
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState?.run?.weaponMastery).toBeDefined();
  });

  it('handles empty patch body', async () => {
    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {},
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState).toEqual(testGameState);
  });

  it('sets playerLevel to 0', async () => {
    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        playerLevel: 0,
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState?.player.level).toBe(0);
  });

  it('sets playerLevel to high value', async () => {
    const result = await app.inject({
      method: 'POST',
      url: `/api/debug/inject/${testGameId}`,
      payload: {
        playerLevel: 999,
      },
    });

    expect(result.statusCode).toBe(200);

    const savedState = vi.mocked(mockRepo.saveGame).mock.calls[0]?.[1];
    expect(savedState?.player.level).toBe(999);
  });
});
