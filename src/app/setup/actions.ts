'use server';
import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import { FirstRunSetupInputSchema } from '@/features/organizations/schemas/access';
import { hashSessionToken, ORGANIZATION_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logError } from '@/lib/logger';
import { hashPassword } from '@/lib/auth/password';
export type SetupState = { message?: string; errors?: Record<string, string[]> };
export async function completeSetup(_: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = FirstRunSetupInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the highlighted details.', errors: parsed.error.flatten().fieldErrors };
  const ids = { userId: randomUUID(), organizationId: randomUUID(), membershipId: randomUUID(), auditEventId: randomUUID() };
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const repository = new OrganizationAccessRepository();
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await repository.createFirstOrganization({ ...ids, ...parsed.data, passwordHash });
    await repository.createSession({ id: randomUUID(), userId: ids.userId, tokenHash: hashSessionToken(token), expiresAt });
  } catch (error) { logError('organization.setup_failed', error); return { message: 'We could not create the workspace. Check that the email and workspace URL are unused.' }; }
  const cookieStore = await cookies();
  const options = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt };
  cookieStore.set(SESSION_COOKIE_NAME, token, options);
  cookieStore.set(ORGANIZATION_COOKIE_NAME, parsed.data.organizationSlug, options);
  redirect('/');
}
