import { expect } from '@playwright/test';
import type { Locator, Page, Request, Response } from '@playwright/test';
import type { GameState } from '@dungeon/contracts';

import { loadScenario } from '../../../packages/game-core/src/fixtures/scenario-fixture-loader.js';
import { serializeState } from '../../../packages/game-core/src/state/serialization.js';
import { RESOLVERS, loadScenarioFile } from '../../contracts/helpers/fixture-loaders.js';
import { E2E_API_BASE } from './api-base.js';
import { applyLayoutPreset } from './layout.js';
import type { LayoutPresetName } from './layout.js';

const SESSION_STORAGE_KEY = 'dungeon-session';
let scenarioLoadSequence = 0;

interface RestoredScenarioSession {
  readonly gameId: string;
  readonly serializedState: string;
  readonly sessionToken: string;
}

export interface ScenarioLoadOptions {
  readonly prepareState?: (state: GameState) => GameState;
  readonly expectedPhase?: 'dungeon' | 'town';
}

export interface ScenarioCommandEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface ScenarioCommandResponse {
  readonly events: readonly ScenarioCommandEvent[];
  readonly view?: unknown;
}

export function tryPostDataJSON(request: Request): unknown | undefined {
  try {
    return request.postDataJSON();
  } catch {
    return undefined;
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function requireSessionField(
  response: Partial<RestoredScenarioSession>,
  field: keyof RestoredScenarioSession,
  scenarioName: string,
): string {
  const value = response[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Scenario "${scenarioName}" restore response is missing ${field}`);
  }
  return value;
}

export class ScenarioPage {
  readonly page: Page;
  readonly scenarioName: string;
  readonly layout: LayoutPresetName;
  readonly session: RestoredScenarioSession;

  private constructor(
    page: Page,
    scenarioName: string,
    layout: LayoutPresetName,
    session: RestoredScenarioSession,
  ) {
    this.page = page;
    this.scenarioName = scenarioName;
    this.layout = layout;
    this.session = session;
  }

  static async load(
    page: Page,
    scenarioName: string,
    layout: LayoutPresetName = 'desktop-default',
    options: ScenarioLoadOptions = {},
  ): Promise<ScenarioPage> {
    await applyLayoutPreset(page, layout);

    let serializedState: string;
    try {
      const fixture = loadScenarioFile(scenarioName);
      scenarioLoadSequence += 1;
      const isolatedFixture = {
        ...fixture,
        name: `${fixture.name}-e2e-${process.pid}-${scenarioLoadSequence}`,
      };
      const loadedState = loadScenario(isolatedFixture, RESOLVERS).state;
      serializedState = serializeState(options.prepareState?.(loadedState) ?? loadedState);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to load scenario fixture "${scenarioName}": ${errorMessage}`,
        { cause: error },
      );
    }

    const restoreResponse = await page.request.post(`${E2E_API_BASE}/games/restore`, {
      data: { serializedState },
    });
    if (!restoreResponse.ok()) {
      throw new Error(
        `Failed to restore scenario "${scenarioName}" (${restoreResponse.status()}): ${await restoreResponse.text()}`,
      );
    }

    const restored = await restoreResponse.json() as Partial<RestoredScenarioSession>;
    const session = {
      gameId: requireSessionField(restored, 'gameId', scenarioName),
      serializedState: requireSessionField(restored, 'serializedState', scenarioName),
      sessionToken: requireSessionField(restored, 'sessionToken', scenarioName),
    };

    await page.addInitScript(({ key, value }) => {
      window.sessionStorage.clear();
      window.localStorage.clear();
      window.sessionStorage.setItem(key, value);
    }, { key: SESSION_STORAGE_KEY, value: JSON.stringify(session) });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const expectedPhase = options.expectedPhase ?? 'dungeon';
    await expect(page.getByTestId(`${expectedPhase}-view`)).toBeVisible({ timeout: 10_000 });
    if (expectedPhase === 'dungeon') {
      await expect(page.getByTestId('dungeon-canvas')).toBeVisible({ timeout: 10_000 });
    }

    return new ScenarioPage(page, scenarioName, layout, session);
  }

  actionButton(label: string): Locator {
    return this.page.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(label)}:`, 'u'),
    });
  }

  waitForCommand(type: string): Promise<Response> {
    return this.page.waitForResponse(response => {
      if (response.request().method() !== 'POST' || !response.url().includes('/commands')) {
        return false;
      }

      const body = tryPostDataJSON(response.request()) as { readonly type?: unknown } | null | undefined;
      return body?.type === type;
    });
  }

  async commandJson(response: Response, expectedType: string): Promise<ScenarioCommandResponse> {
    expect(response.ok()).toBe(true);
    const requestBody = tryPostDataJSON(response.request()) as { readonly type?: unknown } | null | undefined;
    if (requestBody === undefined) {
      throw new Error(
        `Failed to parse JSON request body for expected command "${expectedType}" at ${response.url()}`,
      );
    }
    expect(requestBody?.type).toBe(expectedType);
    return response.json() as Promise<ScenarioCommandResponse>;
  }
}
