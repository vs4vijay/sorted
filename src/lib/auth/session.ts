import 'server-only';

import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
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
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;

  // The organization cookie is only a preference. The repository proves that
  // the session user is an active member before returning an organization.
  const preferredOrganizationSlug = cookieStore.get(ORGANIZATION_COOKIE_NAME)?.value;
  return new OrganizationAccessRepository().findActiveAccessBySessionHash(
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
