import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword } from './password';
describe('password credentials', () => {
  test('stores a salted scrypt hash and verifies without retaining plaintext', async () => {
    const hash = await hashPassword('SortedPass1234');
    expect(hash.startsWith('scrypt$')).toBe(true); expect(hash).not.toContain('SortedPass1234');
    expect(await verifyPassword('SortedPass1234', hash)).toBe(true); expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});
