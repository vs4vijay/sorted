import { Pool } from 'pg';

declare global {
  var sortedPgPool: Pool | undefined;
}

function getPool() {
  if (!global.sortedPgPool) {
    global.sortedPgPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://127.0.0.1:5433/sorted',
      max: process.env.NODE_ENV === 'development' ? 5 : 10,
    });
  }
  return global.sortedPgPool;
}

/** Execute parameterized SQL through PostgreSQL wire protocol. */
export async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}
