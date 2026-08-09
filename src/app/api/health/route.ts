export const dynamic = 'force-dynamic';
export function GET() { return Response.json({ status: 'ok', service: 'sorted-web', timestamp: new Date().toISOString() }); }

