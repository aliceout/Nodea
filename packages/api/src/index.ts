import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/healthz', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://127.0.0.1:${info.port}`);
});

export type AppType = typeof app;
