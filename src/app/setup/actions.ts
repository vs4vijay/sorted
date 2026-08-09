'use server';

import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import { FirstRunSetupInputSchema } from '@/features/organizations/schemas/access';
import {
  mapUniqueViolationToSetupState,
  setupConflictState,
} from '@/features/organizations/setup-conflicts';
import { hashPassword } from '@/lib/auth/password';
import {
  hashSessionToken,
  ORGANIZATION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import { logError } from '@/lib/logger';

export type SetupState = { message?: string; errors?: Record<string, string[]> };

export async function completeSetup(_: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = FirstRunSetupInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      message: 'Check the highlighted details.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const repository = new OrganizationAccessRepository();
  const ids = {
    userId: randomUUID(),
    organizationId: randomUUID(),
    membershipId: randomUUID(),
    auditEventId: randomUUID(),
    sessionId: randomUUID(),
  };
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  try {
    const conflicts = await repository.findSetupConflicts(
      parsed.data.email,
      parsed.data.organizationSlug,
    );
    const conflictState = setupConflictState(conflicts);
    if (conflictState) return conflictState;

    const passwordHash = await hashPassword(parsed.data.password);
    await repository.createFirstOrganizationWithSession({
      ...ids,
      ...parsed.data,
      passwordHash,
      sessionTokenHash: hashSessionToken(token),
      sessionExpiresAt: expiresAt,
    });
  } catch (error) {
    logError('organization.setup_failed', error);
    const databaseMessage =
      error instanceof Error &&
      /relation .* does not exist|database|pglite|mutex|connection/i.test(error.message)
        ? 'The recruiting workspace database is not ready. Restart the local app so setup can initialize it, then try again.'
        : undefined;
    return (
      mapUniqueViolationToSetupState(error) ?? {
        message: databaseMessage ?? 'We could not create the workspace. Try again in a moment.',
      }
    );
  }

  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  };
  cookieStore.set(SESSION_COOKIE_NAME, token, options);
  cookieStore.set(ORGANIZATION_COOKIE_NAME, parsed.data.organizationSlug, options);
  redirect('/');
}
