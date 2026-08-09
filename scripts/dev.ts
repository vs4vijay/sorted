#!/usr/bin/env bun

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { connect } from 'net';

const processes: ChildProcessWithoutNullStreams[] = [];
const colors = { reset: '\x1b[0m', bright: '\x1b[1m', blue: '\x1b[34m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
let shuttingDown = false;

function log(prefix: string, color: string, message: string) {
  console.log(`${color}${colors.bright}[${prefix}]${colors.reset} ${message}`);
}

function localDatabaseConfig() {
  const port = Number(process.env.PGLITE_PORT || 5433);
  const configured = process.env.DATABASE_URL || 'postgresql://127.0.0.1:5433/sorted';
  const legacyFileUrl = configured.startsWith('file:');
  const url = legacyFileUrl ? new URL(`postgresql://127.0.0.1:${port}/sorted`) : new URL(configured);
  const local = legacyFileUrl || (['127.0.0.1', 'localhost'].includes(url.hostname) && Number(url.port || 5432) === port);
  return { local, port, databaseUrl: local ? `postgresql://127.0.0.1:${port}/sorted` : configured };
}

function pipeProcess(prefix: string, color: string, command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { stdio: 'pipe', env });
  child.stdout.on('data', (data) => { const message = data.toString().trim(); if (message) log(prefix, color, message); });
  child.stderr.on('data', (data) => { const message = data.toString().trim(); if (message) log(prefix, color, message); });
  child.on('close', (code) => {
    if (!shuttingDown) {
      log(prefix, colors.red, `Process exited with code ${code}`);
      cleanup(code || 1);
    }
  });
  processes.push(child);
  return child;
}

async function portIsOpen(port: number) {
  return await new Promise<boolean>((resolve) => {
      const socket = connect({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
  });
}

async function waitForPort(port: number, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await portIsOpen(port)) return;
    await Bun.sleep(100);
  }
  throw new Error(`Local database did not become ready on port ${port}.`);
}

function cleanup(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('DEV', colors.yellow, 'Shutting down...');
  for (const process of processes) if (!process.killed) process.kill('SIGTERM');
  setTimeout(() => process.exit(code), 250).unref();
}

process.on('SIGINT', () => cleanup());
process.on('SIGTERM', () => cleanup());

async function main() {
  const database = localDatabaseConfig();
  const childEnv = { ...process.env, DATABASE_URL: database.databaseUrl };
  log('DEV', colors.yellow, 'Starting development environment...');
  if (database.local) {
    if (await portIsOpen(database.port)) {
      throw new Error(`Port ${database.port} is already in use. Set PGLITE_PORT and update the local DATABASE_URL to the same port.`);
    }
    log('DB', colors.green, 'Starting single-owner PGlite database...');
    pipeProcess('DB', colors.green, 'bun', ['run', 'scripts/dev-db.ts'], childEnv);
    await waitForPort(database.port);
  }
  pipeProcess('NEXT', colors.blue, 'bun', ['next', 'dev', '-p', process.env.PORT || '7070'], childEnv);
  pipeProcess('WORKER', colors.green, 'bun', ['--conditions=react-server', 'run', 'src/lib/worker.ts'], childEnv);
  process.stdin.resume();
}

main().catch((error) => {
  log('DEV', colors.red, error instanceof Error ? error.message : 'Development startup failed.');
  cleanup(1);
});
