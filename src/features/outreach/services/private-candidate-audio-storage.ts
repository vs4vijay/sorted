import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.join(process.cwd(), '.sorted-private', 'candidate-audio');
function safeKey(key: string) { if (!/^[a-zA-Z0-9/_-]+$/.test(key) || key.includes('..')) throw new Error('Invalid private candidate audio key.'); return path.join(root, key); }
function secret() { return process.env.AUTH_SECRET || 'local-development-audio-signing-only'; }
export const privateCandidateAudioStorage = {
  async put(key: string, bytes: Uint8Array) { const target = safeKey(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes, { mode: 0o600 }); },
  async get(key: string) { return readFile(safeKey(key)); },
  async remove(key: string) { try { await unlink(safeKey(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } },
  sign(key: string, ttlSeconds = 300) { const expires = Math.floor(Date.now() / 1000) + ttlSeconds; const signature = createHmac('sha256', secret()).update(`${key}.${expires}`).digest('hex'); return { expires, signature }; },
  verify(key: string, expires: number, signature: string) { if (expires < Math.floor(Date.now() / 1000)) return false; const expected = createHmac('sha256', secret()).update(`${key}.${expires}`).digest(); try { return timingSafeEqual(expected, Buffer.from(signature, 'hex')); } catch { return false; } },
};
