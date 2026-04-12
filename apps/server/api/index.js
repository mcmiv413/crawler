// Vercel serverless function entry point.
// Imports buildApp directly and creates the handler inline,
// avoiding re-export chains that confuse Vercel's module resolution.
import { buildApp } from '../dist/app.js';

let app;

export default async function handler(req, res) {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  app.routing(req, res);
}
