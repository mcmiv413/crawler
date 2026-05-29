import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';

async function maybeInstallDungeonE2EBridge(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const maybeWindow = window as Window & {
    __DUNGEON_E2E__?: {
      enabled?: boolean;
    };
  };

  if (maybeWindow.__DUNGEON_E2E__?.enabled !== true) {
    return;
  }

  const { installDungeonE2EBridge } = await import('./testing/e2e-bridge.js');
  installDungeonE2EBridge();
}

async function bootstrap(): Promise<void> {
  await maybeInstallDungeonE2EBridge();

  const root = document.getElementById('root');
  if (!root) {
    return;
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();
