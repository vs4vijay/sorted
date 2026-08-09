import { describe, expect, test } from 'bun:test';
import {
  isUniqueConstraintViolation,
  mapUniqueViolationToSetupState,
  setupConflictState,
} from './setup-conflicts';

describe('setupConflictState', () => {
  test('returns null when nothing is taken', () => {
    expect(setupConflictState({})).toBeNull();
    expect(setupConflictState({ emailTaken: false, slugTaken: false })).toBeNull();
  });

  test('maps email collisions to a sign-in cue', () => {
    expect(setupConflictState({ emailTaken: true })).toEqual({
      message: 'An account with this email already exists. Sign in instead.',
      errors: {
        email: ['An account with this email already exists. Sign in instead.'],
      },
    });
  });

  test('maps slug collisions to a workspace URL error', () => {
    expect(setupConflictState({ slugTaken: true })).toEqual({
      message: 'This workspace URL is already taken. Choose another.',
      errors: {
        organizationSlug: ['This workspace URL is already taken. Choose another.'],
      },
    });
  });

  test('maps both collisions together', () => {
    const state = setupConflictState({ emailTaken: true, slugTaken: true });
    expect(state?.message).toBe('That email and workspace URL are already in use.');
    expect(state?.errors.email).toBeDefined();
    expect(state?.errors.organizationSlug).toBeDefined();
  });
});

describe('unique constraint mapping', () => {
  test('detects Postgres and Prisma unique failures', () => {
    expect(isUniqueConstraintViolation({ code: '23505', message: 'duplicate key' })).toBe(true);
    expect(isUniqueConstraintViolation({ code: 'P2002', meta: { target: ['email'] } })).toBe(true);
    expect(
      isUniqueConstraintViolation({
        code: 'P2010',
        meta: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "users_email_key"',
        },
      }),
    ).toBe(true);
    expect(isUniqueConstraintViolation({ message: 'connection refused' })).toBe(false);
  });

  test('maps users_email_lower_key violations to the email field', () => {
    expect(
      mapUniqueViolationToSetupState({
        code: '23505',
        message: 'duplicate key value violates unique constraint "users_email_lower_key"',
      }),
    ).toEqual(setupConflictState({ emailTaken: true }));
  });

  test('maps users_email_key violations to the email field', () => {
    expect(
      mapUniqueViolationToSetupState({
        code: 'P2010',
        meta: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "users_email_key"',
        },
      }),
    ).toEqual(setupConflictState({ emailTaken: true }));
  });

  test('maps organizations_slug_key violations to the slug field', () => {
    expect(
      mapUniqueViolationToSetupState({
        code: '23505',
        message: 'duplicate key value violates unique constraint "organizations_slug_key"',
      }),
    ).toEqual(setupConflictState({ slugTaken: true }));
  });

  test('returns a shared fallback when the constraint target is unknown', () => {
    const state = mapUniqueViolationToSetupState({ code: '23505', message: 'duplicate key value' });
    expect(state?.message).toBe('That email or workspace URL is already in use.');
    expect(state?.errors.email).toBeDefined();
    expect(state?.errors.organizationSlug).toBeDefined();
  });

  test('returns null for non-unique failures', () => {
    expect(mapUniqueViolationToSetupState({ message: 'relation users does not exist' })).toBeNull();
  });
});
