import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

let client: PrismaClient | undefined;

export function normalizePostgresConnectionString(databaseUrl: string): string {
  const trimmed = databaseUrl.trim();
  if (!trimmed) throw new Error('DATABASE_URL is required.');

  const url = new URL(trimmed);
  if (url.searchParams.get('sslmode') === 'require' && !url.searchParams.has('uselibpqcompat')) {
    // node-postgres currently treats sslmode=require as verify-full unless
    // libpq-compatible semantics are requested explicitly. Supabase's pooler
    // documents require as encrypted TLS without CA/hostname verification.
    url.searchParams.set('uselibpqcompat', 'true');
  }
  return url.toString();
}

export function createPostgresPoolConfig(databaseUrl: string) {
  return {
    connectionString: normalizePostgresConnectionString(databaseUrl),
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  } as const;
}

export function getPrismaClient(databaseUrl: string): PrismaClient {
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaPg(createPostgresPoolConfig(databaseUrl)) });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
