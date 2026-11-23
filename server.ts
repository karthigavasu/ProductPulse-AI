import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.js';
import { getDb } from './server/db.js';
import { seedDatabaseIfEmpty } from './server/seed.js';

const PORT = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  const db = getDb();
  seedDatabaseIfEmpty(db);

  const app = createApp(db);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProductPulse AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ProductPulse AI server:', err);
  process.exit(1);
});
