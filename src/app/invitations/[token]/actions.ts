'use server';

import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import { AcceptInvitationInputSchema } from '@/features/organizations/schemas/access';
import { hashSessionToken, ORGANIZATION_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export type AcceptInvitationState = { message?: string; errors?: Record<string, string[]> };

export async function acceptInvitation(_: AcceptInvitationState, formData: FormData): Promise<AcceptInvitationState> {
  const parsed = AcceptInvitationInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check your name and try again.', errors: parsed.error.flatten().fieldErrors };

  const sessionToken = randomBytes(32).toString('base64url');
  const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const accepted = await new OrganizationAccessRepository().acceptInvitation({
    tokenHash: hashSessionToken(parsed.data.token), name: parsed.data.name, userId: randomUUID(),
    membershipId: randomUUID(), sessionId: randomUUID(), sessionTokenHash: hashSessionToken(sessionToken),
    sessionExpiresAt, auditEventId: randomUUID(),
  });
  if (!accepted) return { message: 'This invitation is no longer available. Ask the workspace administrator for a new one.' };

  const cookieStore = await cookies();
  const options = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', expires: sessionExpiresAt };
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, options);
  cookieStore.set(ORGANIZATION_COOKIE_NAME, accepted.organizationSlug, options);
  redirect('/');
}
