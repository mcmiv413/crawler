import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { GameView, CombatLogEntry } from '@dungeon/presenter';
import {
  createGame,
  fetchGameView,
  sendCommand,
  restoreGame,
  GameNotFoundError,
  fetchNpcDialogue,
  type CreateGameResponse,
  type CommandResponse,
  type NpcDialogueResponse,
} from './client.js';

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

/**
 * Helper builders to avoid brittle test data.
 */

const BASE_PLAYER = {
  name: 'TestHero',
  level: 1,
  health: 100,
  maxHealth: 100,
  attack: 10,
  defense: 5,
  accuracy: 80,
  evasion: 20,
  speed: 1,
  resistances: {} as Record<string, number>,
  gold: 0,
  floor: 1,
  experience: 0,
  experienceForNextLevel: 100,
  biomeId: null as string | null,
  biomeColor: '#888888',
  statuses: [] as never[],
  abilities: [] as never[],
  weaponMastery: null,
  equippedItems: [] as never[],
  statBreakdowns: {} as Record<string, never>,
  activeQuests: [] as never[],
  nemesisInfo: null,
  factionStandings: [] as never[],
};

class GameViewBuilder {
  private gameId: string = randomUUID();
  private playerHealth: number = 100;
  private phase: GameView['phase'] = 'dungeon';

  withGameId(gameId: string): this {
    this.gameId = gameId;
    return this;
  }

  withPlayerHealth(health: number): this {
    this.playerHealth = health;
    return this;
  }

  withCombatStatus(_isCombat: boolean): this {
    this.phase = _isCombat ? 'combat' : 'dungeon';
    return this;
  }

  build(): GameView {
    return {
      gameId: this.gameId,
      phase: this.phase,
      player: { ...BASE_PLAYER, health: this.playerHealth },
      map: null,
      combatLog: [],
      availableActions: [],
      town: null,
      inventory: {
        items: [],
        equipped: {
          weapon: null,
          secondaryWeapon: null,
          chest: null,
          head: null,
          gloves: null,
          boots: null,
          ring1: null,
          ring2: null,
        },
      },
      activeQuests: [],
      runResult: null,
      deathStashFloor: null,
      deathSummary: null,
      deathContext: null,
      inspectableEntities: [],
      recentlyDefeatedNemesis: null,
      debugMode: false,
    };
  }
}

class CreateGameResponseBuilder {
  private data: Partial<CreateGameResponse> = {
    gameId: randomUUID(),
    view: new GameViewBuilder().build(),
    serializedState: '{"version":"1","state":{}}',
  };

  withGameId(gameId: string): this {
    this.data.gameId = gameId;
    return this;
  }

  build(): CreateGameResponse {
    return {
      gameId: this.data.gameId ?? randomUUID(),
      view: this.data.view ?? new GameViewBuilder().build(),
      serializedState: this.data.serializedState ?? '{"version":"1","state":{}}',
    };
  }
}

class CommandResponseBuilder {
  private data: Partial<CommandResponse> = {
    view: new GameViewBuilder().build() as CommandResponse['view'],
    events: [],
    runEnded: false,
    serializedState: '{"version":"1","state":{}}',
  };

  build(): CommandResponse {
    return {
      view: this.data.view ?? (new GameViewBuilder().build() as CommandResponse['view']),
      events: this.data.events ?? [],
      runEnded: this.data.runEnded ?? false,
      serializedState: this.data.serializedState ?? '{"version":"1","state":{}}',
    };
  }
}

/**
 * Helper to create a mock Response object
 */
function mockResponse<T>(data: T, options: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const { ok = true, status = 200, statusText = 'OK' } = options;
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

/**
 * Helper to create a mock Response that fails JSON parsing
 */
function mockResponseJsonFails(options: { status?: number; statusText?: string } = {}) {
  const { status = 500, statusText = 'Internal Server Error' } = options;
  return {
    ok: false,
    status,
    statusText,
    json: vi.fn().mockRejectedValue(new Error('JSON parse failed')),
  } as unknown as Response;
}

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('json() response handler (tested via createGame)', () => {
    it('parses successful response (res.ok=true)', async () => {
      const expectedData = new CreateGameResponseBuilder().build();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(expectedData));

      const result = await createGame();

      expect(result.gameId).toBe(expectedData.gameId);
      expect(result.view).toEqual(expectedData.view);
      expect(result.serializedState).toBe(expectedData.serializedState);
    });

    it('throws formatted error when res.ok=false and res.json() succeeds', async () => {
      const errorResponse = { error: 'Invalid request parameters' };
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(errorResponse, { ok: false, status: 400, statusText: 'Bad Request' }));

      await expect(createGame()).rejects.toThrow('Invalid request parameters');
    });

    it('uses statusText fallback when res.ok=false and res.json() throws', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponseJsonFails({ status: 500, statusText: 'Internal Server Error' }));

      await expect(createGame()).rejects.toThrow('Internal Server Error');
    });
  });

  describe('createGame()', () => {
    it('sends POST request with seed and playerName, returns CreateGameResponse', async () => {
      const gameId = randomUUID();
      const response = new CreateGameResponseBuilder().withGameId(gameId).build();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(response));

      const result = await createGame(42, 'TestHero');

      expect(mockFetch).toHaveBeenCalledOnce();
      const callUrl = mockFetch.mock.calls[0]![0] as string;
      expect(callUrl).toMatch(/\/games$/);
      const callOptions = mockFetch.mock.calls[0]![1];
      expect(callOptions).toBeDefined();
      if (callOptions) {
        expect(callOptions.method).toBe('POST');
        const body = JSON.parse(callOptions.body as string);
        expect(body.seed).toBe(42);
        expect(body.playerName).toBe('TestHero');
      }
      expect(result.gameId).toBe(gameId);
      expect(result.view).toBeDefined();
      expect(result.serializedState).toBeDefined();
    });

    it('throws Error when server returns 500', async () => {
      const mockFetch = vi.mocked(global.fetch);
      const response = mockResponse({ error: 'Database error' }, { ok: false, status: 500 });
      mockFetch.mockResolvedValueOnce(response);

      await expect(createGame()).rejects.toThrow('Database error');
    });
  });

  describe('fetchGameView()', () => {
    it('sends GET request to /games/:id/view, returns GameView', async () => {
      const gameId = randomUUID();
      const view = new GameViewBuilder().withGameId(gameId).build();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(view));

      const result = await fetchGameView(gameId);

      expect(mockFetch).toHaveBeenCalledOnce();
      const callUrl = mockFetch.mock.calls[0]![0] as string;
      expect(callUrl).toMatch(new RegExp(`/games/${gameId}/view`));
      expect(result.gameId).toBe(gameId);
      expect(result.player).toBeDefined();
    });
  });

  describe('sendCommand()', () => {
    it('sends POST request with command, returns CommandResponse', async () => {
      const gameId = randomUUID();
      const command = { type: 'MOVE', direction: 'north' };
      const response = new CommandResponseBuilder().build();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(response));

      const result = await sendCommand(gameId, command);

      expect(mockFetch).toHaveBeenCalledOnce();
      const callUrl = mockFetch.mock.calls[0]![0] as string;
      expect(callUrl).toMatch(new RegExp(`/games/${gameId}/commands`));
      const callOptions = mockFetch.mock.calls[0]![1];
      expect(callOptions).toBeDefined();
      if (callOptions) {
        expect(callOptions.method).toBe('POST');
        expect(callOptions.body).toEqual(JSON.stringify(command));
      }
      expect(result.view).toBeDefined();
      expect(result.serializedState).toBeDefined();
      expect(typeof result.runEnded).toBe('boolean');
    });

    it('throws GameNotFoundError when server returns 404', async () => {
      const gameId = randomUUID();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: 'Not found' }, { ok: false, status: 404, statusText: 'Not Found' }),
      );

      const error = await expect(sendCommand(gameId, {})).rejects.toThrow(GameNotFoundError);
      await expect(sendCommand(gameId, {})).rejects.toThrow();
    });

    it('GameNotFoundError instanceof check and gameId property', async () => {
      const gameId = randomUUID();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: 'Not found' }, { ok: false, status: 404, statusText: 'Not Found' }),
      );

      try {
        await sendCommand(gameId, {});
        expect.fail('Should have thrown GameNotFoundError');
      } catch (err) {
        expect(err instanceof GameNotFoundError).toBe(true);
        if (err instanceof GameNotFoundError) {
          expect(err.gameId).toBe(gameId);
          expect(err.name).toBe('GameNotFoundError');
        }
      }
    });
  });

  describe('restoreGame()', () => {
    it('sends POST request with serializedState, returns CreateGameResponse', async () => {
      const gameId = randomUUID();
      const serializedState = '{"version":"1","state":{"player":{"health":50}}}';
      const response = new CreateGameResponseBuilder().withGameId(gameId).build();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(response));

      const result = await restoreGame(serializedState);

      expect(mockFetch).toHaveBeenCalledOnce();
      const callUrl = mockFetch.mock.calls[0]![0] as string;
      expect(callUrl).toMatch(/\/games\/restore$/);
      const callOptions = mockFetch.mock.calls[0]![1];
      expect(callOptions).toBeDefined();
      if (callOptions) {
        expect(callOptions.method).toBe('POST');
        const body = JSON.parse(callOptions.body as string);
        expect(body.serializedState).toBe(serializedState);
      }
      expect(result.gameId).toBeDefined();
      expect(result.view).toBeDefined();
      expect(result.serializedState).toBeDefined();
    });
  });

  describe('GameNotFoundError', () => {
    it('creates custom error with name and gameId properties', () => {
      const gameId = randomUUID();
      const error = new GameNotFoundError(gameId);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GameNotFoundError);
      expect(error.name).toBe('GameNotFoundError');
      expect(error.message).toBe('Game not found');
      expect(error.gameId).toBe(gameId);
    });
  });

  describe('fetchNpcDialogue()', () => {
    it('sends GET request to /games/:id/npc/:npcId/dialogue, returns NpcDialogueResponse', async () => {
      const gameId = randomUUID();
      const npcId = 'merchant_1';
      const response: NpcDialogueResponse = {
        npcId,
        npcName: 'Old Merchant',
        dialogue: 'Welcome to my shop!',
      };
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(response));

      const result = await fetchNpcDialogue(gameId, npcId);

      expect(mockFetch).toHaveBeenCalledOnce();
      const callUrl = mockFetch.mock.calls[0]![0] as string;
      expect(callUrl).toMatch(new RegExp(`/games/${gameId}/npc/${npcId}/dialogue`));
      expect(result.npcId).toBe(npcId);
      expect(result.npcName).toBe('Old Merchant');
      expect(result.dialogue).toBe('Welcome to my shop!');
    });
  });

  describe('Error handling edge cases', () => {
    it('handles 400 Bad Request with error message', async () => {
      const mockFetch = vi.mocked(global.fetch);
      const response = mockResponse({ error: 'Validation failed' }, { ok: false, status: 400 });
      mockFetch.mockResolvedValueOnce(response);

      await expect(createGame()).rejects.toThrow('Validation failed');
    });

    it('handles 422 Unprocessable Entity', async () => {
      const mockFetch = vi.mocked(global.fetch);
      const response = mockResponse({ error: 'Invalid state' }, { ok: false, status: 422 });
      mockFetch.mockResolvedValueOnce(response);

      await expect(createGame()).rejects.toThrow('Invalid state');
    });

    it('handles 503 Service Unavailable', async () => {
      const mockFetch = vi.mocked(global.fetch);
      const response = mockResponse({ error: 'Service temporarily unavailable' }, { ok: false, status: 503 });
      mockFetch.mockResolvedValueOnce(response);

      await expect(createGame()).rejects.toThrow('Service temporarily unavailable');
    });

    it('falls back to statusText when no error object in response', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponseJsonFails({ status: 502, statusText: 'Bad Gateway' }));

      await expect(createGame()).rejects.toThrow('Bad Gateway');
    });

    it('falls back to HTTP status code when no statusText available', async () => {
      const mockFetch = vi.mocked(global.fetch);
      const response = {
        ok: false,
        status: 500,
        statusText: '',
        json: vi.fn().mockRejectedValue(new Error('JSON parse failed')),
      } as unknown as Response;
      mockFetch.mockResolvedValueOnce(response);

      await expect(createGame()).rejects.toThrow();
    });
  });

  describe('Request body serialization', () => {
    it('correctly serializes createGame parameters', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(new CreateGameResponseBuilder().build()));

      await createGame(123, 'Legolas');

      const call = mockFetch.mock.calls[0]!;
      const body = JSON.parse(call[1]?.body as string);
      expect(body.seed).toBe(123);
      expect(body.playerName).toBe('Legolas');
    });

    it('correctly serializes sendCommand command object', async () => {
      const gameId = randomUUID();
      const command = { type: 'ATTACK', targetId: 'enemy_1' };
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(new CommandResponseBuilder().build()));

      await sendCommand(gameId, command);

      const call = mockFetch.mock.calls[0]!;
      const body = JSON.parse(call[1]?.body as string);
      expect(body).toEqual(command);
    });

    it('correctly serializes restoreGame serializedState', async () => {
      const serializedState = '{"data":"test"}';
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(new CreateGameResponseBuilder().build()));

      await restoreGame(serializedState);

      const call = mockFetch.mock.calls[0]!;
      const body = JSON.parse(call[1]?.body as string);
      expect(body.serializedState).toBe(serializedState);
    });
  });

  describe('Response parsing', () => {
    it('parses complex GameView response structure', async () => {
      const gameId = randomUUID();
      const view = new GameViewBuilder().withGameId(gameId).build();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(view));

      const result = await fetchGameView(gameId);

      expect(result).toHaveProperty('gameId', gameId);
      expect(result).toHaveProperty('player');
      expect(result.player).toHaveProperty('name');
      expect(result.player).toHaveProperty('health');
    });

    it('parses CommandResponse with multiple fields', async () => {
      const gameId = randomUUID();
      const response = new CommandResponseBuilder().build();
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce(mockResponse(response));

      const result = await sendCommand(gameId, {});

      expect(result).toHaveProperty('view');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('runEnded');
      expect(result).toHaveProperty('serializedState');
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('HTTP status code handling', () => {
    it('distinguishes between 4xx and 5xx errors', async () => {
      const mockFetch = vi.mocked(global.fetch);

      // 4xx
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not found' }, { ok: false, status: 404 }));
      await expect(createGame()).rejects.toThrow('Not found');

      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Bad request' }, { ok: false, status: 400 }));
      await expect(createGame()).rejects.toThrow('Bad request');

      // 5xx
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Server error' }, { ok: false, status: 500 }));
      await expect(createGame()).rejects.toThrow('Server error');

      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Service unavailable' }, { ok: false, status: 503 }));
      await expect(createGame()).rejects.toThrow('Service unavailable');
    });
  });
});
