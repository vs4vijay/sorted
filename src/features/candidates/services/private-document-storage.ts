import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.join(process.cwd(), '.sorted-private', 'candidate-documents');
function safeKey(key: string) {
  if (!/^[a-zA-Z0-9/_-]+$/.test(key) || key.includes('..'))
    throw new Error('Invalid private storage key.');
  return path.join(root, key);
}
function signingSecret() {
  return process.env.AUTH_SECRET || 'local-development-document-signing-only';
}
export const privateDocumentStorage = {
  async put(key: string, bytes: Uint8Array) {
    const target = safeKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { mode: 0o600 });
  },
  async get(key: string) {
    return readFile(safeKey(key));
  },
  async delete(key: string) {
    try {
      await unlink(safeKey(key));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  },
  sign(key: string, ttlSeconds = 300) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const value = `${key}.${expires}`;
    const signature = createHmac('sha256', signingSecret()).update(value).digest('hex');
    return { expires, signature };
  },
  verify(key: string, expires: number, signature: string) {
    if (expires < Math.floor(Date.now() / 1000)) return false;
    const expected = createHmac('sha256', signingSecret()).update(`${key}.${expires}`).digest();
    try {
      return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  },
};
