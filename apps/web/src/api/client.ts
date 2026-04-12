import type { GameView, CombatLogEntry } from '@dungeon/presenter';

export interface CreateGameResponse {
  gameId: string;
  view: GameView;
}

export interface CommandResponse {
  view: GameView & { combatLog: CombatLogEntry[] };
  events: unknown[];
  runEnded: boolean;
}

const BASE = '/api';

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
  return json<CommandResponse>(res);
}
