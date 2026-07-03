export const DEFAULT_E2E_API_BASE = 'http://127.0.0.1:3000/api';

export function resolveE2eApiBase(
  configuredBase: string | undefined = process.env.E2E_API_BASE,
): string {
  return new URL(configuredBase ?? DEFAULT_E2E_API_BASE).toString().replace(/\/$/u, '');
}

export const E2E_API_BASE = resolveE2eApiBase();
