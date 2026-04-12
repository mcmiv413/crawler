import type { GameView, CombatLogEntry } from '@dungeon/presenter';
import { API_BASE_URL } from '../config/api.js';

export interface CreateGameResponse {
  gameId: string;
  view: GameView;
  serializedState: string;
}

export interface CommandResponse {
  view: GameView & { combatLog: CombatLogEntry[] };
  events: unknown[];
  runEnded: boolean;
  serializedState: string;
}

const BASE = API_BASE_URL;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function createGame(seed?: number, playerName?: string): Promise<CreateGameResponse> {
  const res = await fetch(`${BASE}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed, playerName }),
  });
  return json<CreateGameResponse>(res);
}

export async function fetchGameView(gameId: string): Promise<GameView> {
  const res = await fetch(`${BASE}/games/${gameId}/view`);
  return json<GameView>(res);
}

export interface NpcDialogueResponse {
  npcId: string;
  npcName: string;
  dialogue: string;
}

export async function fetchNpcDialogue(gameId: string, npcId: string): Promise<NpcDialogueResponse> {
  const res = await fetch(`${BASE}/games/${gameId}/npc/${npcId}/dialogue`);
  return json<NpcDialogueResponse>(res);
}

export async function sendCommand(gameId: string, command: unknown): Promise<CommandResponse> {
  const res = await fetch(`${BASE}/games/${gameId}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (res.status === 404) {
    throw new GameNotFoundError(gameId);
  }
  return json<CommandResponse>(res);
}

export class GameNotFoundError extends Error {
  readonly gameId: string;
  constructor(gameId: string) {
    super('Game not found');
    this.name = 'GameNotFoundError';
    this.gameId = gameId;
  }
}

export async function restoreGame(serializedState: string): Promise<CreateGameResponse> {
  const res = await fetch(`${BASE}/games/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serializedState }),
  });
  return json<CreateGameResponse>(res);
}
