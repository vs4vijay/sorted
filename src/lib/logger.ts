import 'server-only';

const sensitiveKey =
  /authorization|cookie|token|secret|password|api[_-]?key|email|phone|message|transcript|cv/i;
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : redact(item),
      ]),
    );
  return value;
}
export function log(event: string, fields: Record<string, unknown> = {}) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      event,
      fields: redact(fields),
    }),
  );
}
export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event,
      error:
        error instanceof Error ? { name: error.name, message: error.message } : 'Unknown error',
      fields: redact(fields),
    }),
  );
}
