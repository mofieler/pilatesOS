import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DATABASE_CONFIG } from '@/constants/DATABASE_CONFIG';

// Singleton pattern — prevents connection pool exhaustion during Next.js hot reload in dev.
const globalForDb = globalThis as unknown as { client: ReturnType<typeof postgres> | undefined };

const client =
  globalForDb.client ??
  postgres(process.env.DATABASE_URL!, {
    max: DATABASE_CONFIG.CONNECTION_POOL.MAX_CONNECTIONS,
    idle_timeout: DATABASE_CONFIG.CONNECTION_POOL.IDLE_TIMEOUT_SECONDS,
    connect_timeout: DATABASE_CONFIG.CONNECTION_POOL.CONNECT_TIMEOUT_SECONDS,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
