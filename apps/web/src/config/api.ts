/**
 * Central API base URL configuration.
 *
 * Resolution order:
 * 1. VITE_API_BASE_URL env var (set for hosted/Vercel deployments)
 * 2. '/api' relative path (local dev via Vite proxy, Docker via nginx proxy)
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? '/api';
