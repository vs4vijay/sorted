#!/usr/bin/env bun

/**
 * Development runner
 * Starts both Next.js dev server and Graphile Worker concurrently
 */

import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'child_process';

const processes: ChildProcessWithoutNullStreams[] = [];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(prefix: string, color: string, message: string) {
  console.log(`${color}${colors.bright}[${prefix}]${colors.reset} ${message}`);
}

function initializeLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
  if (!databaseUrl.startsWith('file:')) return;
  log('DB', colors.green, 'Checking local PGlite schema...');
  const result = spawnSync('bun', ['run', 'db:init'], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    log('DB', colors.red, 'Local database initialization failed. Stop other Sorted dev processes and retry.');
    process.exit(result.status ?? 1);
  }
}

// Start Next.js dev server
function startNextJS() {
  log('NEXT', colors.blue, 'Starting Next.js dev server...');

  const next = spawn('bun', ['next', 'dev'], {
    stdio: 'pipe',
    shell: true,
  });

  next.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) log('NEXT', colors.blue, message);
  });

  next.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) log('NEXT', colors.blue, message);
  });

  next.on('close', (code) => {
    log('NEXT', colors.red, `Process exited with code ${code}`);
    cleanup();
  });

  processes.push(next);
}

// Start Graphile Worker
function startWorker() {
  log('WORKER', colors.green, 'Starting Graphile Worker...');

  const worker = spawn('bun', ['--conditions=react-server', 'run', 'src/lib/worker.ts'], {
    stdio: 'pipe',
    shell: true,
  });

  worker.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) log('WORKER', colors.green, message);
  });

  worker.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) log('WORKER', colors.green, message);
  });

  worker.on('close', (code) => {
    log('WORKER', colors.red, `Process exited with code ${code}`);
    cleanup();
  });

  processes.push(worker);
}

// Cleanup on exit
function cleanup() {
  log('DEV', colors.yellow, 'Shutting down...');

  processes.forEach((proc) => {
    if (proc && !proc.killed) {
      proc.kill();
    }
  });

  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start all processes
log('DEV', colors.yellow, 'Starting development environment...');
initializeLocalDatabase();
startNextJS();

// Start the worker after Next has initialized its development runtime.
setTimeout(() => {
  startWorker();
}, 2000);

// Keep the process running
process.stdin.resume();
