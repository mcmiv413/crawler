// Vercel serverless function entry point.
// Plain .js re-export to avoid TypeScript/JavaScript filename conflicts.
// Delegates to the compiled Fastify handler in dist/.
export { default } from '../dist/api.js';
