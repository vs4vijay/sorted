'use server';
import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthenticationRepository } from '@/features/organizations/repositories/authentication-repository';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import { SignInInputSchema } from '@/features/organizations/schemas/access';
import { hashSessionToken, ORGANIZATION_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
export type AuthState = { message?: string; errors?: Record<string, string[]> };
const cookieOptions = (expires: Date) => ({ httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', expires });
export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignInInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Enter a valid email and password.', errors: parsed.error.flatten().fieldErrors };
  const user = await new AuthenticationRepository().findUserForSignIn(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return { message: 'Email or password is incorrect.' };
  const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await new OrganizationAccessRepository().createSession({ id: randomUUID(), userId: user.id, tokenHash: hashSessionToken(token), expiresAt });
  const store = await cookies(); store.set(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt)); store.set(ORGANIZATION_COOKIE_NAME, user.organizationSlug, cookieOptions(expiresAt)); redirect('/');
}
