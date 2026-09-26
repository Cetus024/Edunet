import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseDotenv } from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, 'apps', 'web');
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

if (!existsSync(nextBin)) {
  console.error('Next.js is not installed. Run npm install from the repository root.');
  process.exit(1);
}

const envPath = join(root, '.env.local');
if (existsSync(envPath)) {
  const envValues = parseDotenv(readFileSync(envPath));
  for (const [key, value] of Object.entries(envValues)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

const args = process.argv.slice(2);
const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: webRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
