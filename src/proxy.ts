import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'sorted_session';

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/positions/:path*', '/candidates/:path*', '/reviews/:path*', '/outreach/:path*', '/settings/:path*', '/jobs/:path*'],
};
