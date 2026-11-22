import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export function getDb(connectionString?: string): NodePgDatabase<typeof schema> {
  if (!db) {
    const connStr =
      connectionString ||
      process.env.DATABASE_URL ||
      'postgresql://pulsestack:pulsestack@localhost:5432/pulsestack';

    pool = new Pool({
      connectionString: connStr,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    db = drizzle(pool, { schema });
  }

  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export type DbClient = NodePgDatabase<typeof schema>;
