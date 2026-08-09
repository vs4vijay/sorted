#!/usr/bin/env bun

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { ensureSchema } from './init-db';

if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
  throw new Error('The PGlite socket server is development-only.');
}

const host = '127.0.0.1';
const port = Number(process.env.PGLITE_PORT || 5433);
const dataDir = process.env.PGLITE_DATA_DIR || './dev.db';
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PGLITE_PORT must be between 1024 and 65535.');

const db = new PGlite(dataDir);
await db.waitReady;
await ensureSchema(db);

const server = new PGLiteSocketServer({ db, host, port, maxConnections: 20 });
await server.start();
console.log(`🗄️  PGlite socket server on ${host}:${port} (${dataDir})`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop();
  await db.close();
  process.exit(0);
}

process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
process.stdin.resume();
