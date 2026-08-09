import { NextRequest, NextResponse } from 'next/server';
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const correlationId = requestHeaders.get('x-correlation-id') ?? crypto.randomUUID();
  requestHeaders.set('x-correlation-id', correlationId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-correlation-id', correlationId);
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

