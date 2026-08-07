import './env.js';
import { serve } from '@hono/node-server';
import { pool } from '../../../database/index.js';
import { app } from './app.js';
import { env } from './env.js';

const server = serve({
  fetch: app.fetch,
  hostname: env.host,
  port: env.port,
});

console.info(JSON.stringify({
  level: 'info',
  message: 'EduNets API started',
  host: env.host,
  port: env.port,
  environment: env.nodeEnv,
}));

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.info(JSON.stringify({ level: 'info', message: 'EduNets API stopping', signal }));

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await pool.end();
      clearTimeout(forceExit);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
