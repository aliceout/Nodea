import { serve } from '@hono/node-server';
import { buildApp } from './app.ts';
import { getConfig } from './config.ts';

const { PORT } = getConfig();
const app = buildApp();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[api] listening on http://127.0.0.1:${info.port}`);
});

export type { AppType } from './app.ts';
