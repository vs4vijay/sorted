import 'server-only';

import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import { getServerEnv } from '@/lib/env';
import {
  roleCan,
  type OrganizationPermission,
  type ResolvedOrganizationAccess,
} from '@/features/organizations/schemas/access';

export const SESSION_COOKIE_NAME = 'sorted_session';
export const ORGANIZATION_COOKIE_NAME = 'sorted_organization';

export class AccessError extends Error {
  constructor(
    public readonly code: 'unauthenticated' | 'forbidden',
    message: string,
  ) {
    super(message);
    this.name = 'AccessError';
  }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const resolveAccess = cache(async (): Promise<ResolvedOrganizationAccess | null> => {
  const repository = new OrganizationAccessRepository();
  // Read request cookies even in bypass mode so Next.js keeps every auth-aware
  // route dynamic and evaluates the server-only flag at request time.
  const cookieStore = await cookies();
  if (getServerEnv().LOCAL_AUTH_BYPASS) {
    return repository.ensureLocalDevelopmentAccess();
  }

  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;

  // The organization cookie is only a preference. The repository proves that
  // the session user is an active member before returning an organization.
  const preferredOrganizationSlug = cookieStore.get(ORGANIZATION_COOKIE_NAME)?.value;
  return repository.findActiveAccessBySessionHash(
    hashSessionToken(sessionToken),
    preferredOrganizationSlug,
  );
});

export async function getCurrentAccess(): Promise<ResolvedOrganizationAccess | null> {
  return resolveAccess();
}

export async function requireCurrentAccess(
  permission?: OrganizationPermission,
): Promise<ResolvedOrganizationAccess> {
  const access = await getCurrentAccess();
  if (!access) throw new AccessError('unauthenticated', 'Sign in to continue.');
  if (permission && !roleCan(access.membership.role, permission)) {
    throw new AccessError('forbidden', 'Your organization role does not allow this action.');
  }
  return access;
}

export async function requirePageAccess(
  permission?: OrganizationPermission,
): Promise<ResolvedOrganizationAccess> {
  const access = await getCurrentAccess();
  if (!access) redirect('/sign-in');
  if (permission && !roleCan(access.membership.role, permission)) {
    throw new AccessError('forbidden', 'Your organization role does not allow this page.');
  }
  return access;
}
