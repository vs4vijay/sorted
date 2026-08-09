import { executeQuery } from '@/lib/db';
import { log, logError } from '@/lib/logger';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') ?? crypto.randomUUID();
  try { await executeQuery('SELECT 1 AS ready'); log('readiness_check_succeeded', { correlationId }); return Response.json({ status: 'ready', checks: { database: 'ok' } }, { headers: { 'x-correlation-id': correlationId } }); }
  catch (error) { logError('readiness_check_failed', error, { correlationId }); return Response.json({ status: 'not_ready', checks: { database: 'failed' } }, { status: 503, headers: { 'x-correlation-id': correlationId } }); }
}

