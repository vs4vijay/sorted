import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.join(process.cwd(), '.sorted-private', 'voice-notes');
function safeKey(key: string) {
  if (!/^[a-zA-Z0-9/_-]+$/.test(key) || key.includes('..'))
    throw new Error('Invalid private audio key.');
  return path.join(root, key);
}

export const privateAudioStorage = {
  async put(key: string, bytes: Uint8Array) {
    const target = safeKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { mode: 0o600 });
  },
  async get(key: string) {
    return readFile(safeKey(key));
  },
  async remove(key: string) {
    try {
      await unlink(safeKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  },
};
