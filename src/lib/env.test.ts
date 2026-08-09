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

  test('defaults application queries to the local PostgreSQL wire endpoint', () => {
    expect(parseServerEnv({}).DATABASE_URL).toBe('postgresql://127.0.0.1:5433/sorted');
  });

  test('rejects file database URLs in application processes', () => {
    expect(() => parseServerEnv({ DATABASE_URL: 'file:./dev.db' })).toThrow(
      'Application processes require a PostgreSQL wire URL',
    );
  });
});
