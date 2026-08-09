import { describe, expect, test } from 'bun:test';
import { parseServerEnv } from './env-schema';

describe('server environment', () => {
  test('keeps local auth bypass disabled by default', () => {
    expect(parseServerEnv({}).LOCAL_AUTH_BYPASS).toBe(false);
  });

  test('allows local auth bypass in the development app environment', () => {
    expect(parseServerEnv({ APP_ENV: 'development', LOCAL_AUTH_BYPASS: 'true' }).LOCAL_AUTH_BYPASS).toBe(true);
  });

  test('rejects local auth bypass outside development', () => {
    expect(() => parseServerEnv({ APP_ENV: 'production', LOCAL_AUTH_BYPASS: 'true' })).toThrow(
      'LOCAL_AUTH_BYPASS can only be enabled when APP_ENV=development.',
    );
  });
});
