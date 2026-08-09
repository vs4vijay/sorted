'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import { getCurrentAccess, ORGANIZATION_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/auth/session';
export async function signOut(): Promise<void> {
  const access = await getCurrentAccess();
  if (access) await new OrganizationAccessRepository().revokeSession(access.sessionId);
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME); cookieStore.delete(ORGANIZATION_COOKIE_NAME);
  redirect('/sign-in');
}
