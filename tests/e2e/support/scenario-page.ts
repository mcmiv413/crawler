import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
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
      throw new Error(
        `Failed to load scenario fixture "${scenarioName}": ${(error as Error).message}`,
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
    await expect(page.getByTestId('dungeon-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('dungeon-canvas')).toBeVisible({ timeout: 10_000 });

    return new ScenarioPage(page, scenarioName, layout, session);
  }
}
