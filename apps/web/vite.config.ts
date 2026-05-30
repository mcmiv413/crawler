import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_API_BASE = 'http://localhost:3000/api';

function resolveApiProxyConfig() {
  const apiBaseUrl = new URL(process.env['E2E_API_BASE'] ?? DEFAULT_API_BASE);
  const apiBasePath = apiBaseUrl.pathname.replace(/\/$/, '');

  return {
    target: apiBaseUrl.origin,
    changeOrigin: true,
    rewrite:
      apiBasePath === '/api'
        ? undefined
        : (path: string) => path.replace(/^\/api(?=\/|$)/, apiBasePath),
  };
}

const apiProxyConfig = resolveApiProxyConfig();

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom')) {
            return 'react';
          }
          if (id.includes('/node_modules/zustand')) {
            return 'state';
          }
          if (id.includes('/packages/content/')) {
            return 'content';
          }
          if (id.includes('/apps/web/src/animations/')) {
            return 'animations';
          }
          if (id.includes('/apps/web/src/sprites/')) {
            return 'sprites';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    proxy: {
      '/api': apiProxyConfig,
    },
  },
});
