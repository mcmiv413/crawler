import { defineConfig, devices } from '@playwright/test';

const DEFAULT_API_BASE = 'http://localhost:3000/api';
const DEFAULT_APP_BASE = 'http://localhost:8180/';

function resolveUrl(envName: 'E2E_API_BASE' | 'E2E_APP_BASE', fallback: string): URL {
  return new URL(process.env[envName] ?? fallback);
}

function resolvePort(url: URL): number {
  if (url.port !== '') {
    return Number.parseInt(url.port, 10);
  }

  return url.protocol === 'https:' ? 443 : 80;
}

const apiBaseUrl = resolveUrl('E2E_API_BASE', DEFAULT_API_BASE);
const appBaseUrl = resolveUrl('E2E_APP_BASE', DEFAULT_APP_BASE);
const apiPort = resolvePort(apiBaseUrl);
const appPort = resolvePort(appBaseUrl);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60_000,
  use: {
    baseURL: appBaseUrl.toString(),
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `PORT=${apiPort} pnpm --filter @dungeon/server dev`,
      port: apiPort,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @dungeon/web dev --port ${appPort}`,
      port: appPort,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
